import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  alertDurationMs,
  alertTone,
  ALERT_TONES,
  beepSpanMs,
  clampBeeps,
  describeAlert,
  DEFAULT_ALERT_BEEPS,
  DEFAULT_ALERT_TONE,
  MAX_ALERT_BEEPS,
  vibrationPattern,
} from "../alert";
import { suggestDailyGoal, clampDailyGoal } from "../goal";
import { computeProgress } from "../progress";
import { computeStreaks, streakMessage } from "../streak";
import { evaluateReminder, type ReminderContext } from "../reminder-engine";
import { expectedFraction, paceWindow } from "../pace";
import { generateInsights } from "../insights";
import {
  addDays,
  daysBetween,
  formatTimeOfDay,
  isWithinWindow,
  minutesOfDay,
  parseTimeOfDay,
  toDayKey,
  zonedTimeToInstant,
} from "../time";
import { formatVolume, formatServing, roundToServing } from "../units";

describe("time", () => {
  it("resolves the local day across timezones", () => {
    const instant = new Date("2026-09-07T23:30:00Z");
    assert.equal(toDayKey(instant, "UTC"), "2026-09-07");
    assert.equal(toDayKey(instant, "Asia/Kolkata"), "2026-09-08");
    assert.equal(toDayKey(instant, "America/Los_Angeles"), "2026-09-07");
  });

  it("reads minutes of day in the user's zone", () => {
    const instant = new Date("2026-09-07T09:15:00Z");
    assert.equal(minutesOfDay(instant, "UTC"), 9 * 60 + 15);
    assert.equal(minutesOfDay(instant, "Asia/Kolkata"), 14 * 60 + 45);
  });

  it("round-trips a local wall clock time through UTC", () => {
    const instant = zonedTimeToInstant("2026-09-07", 8 * 60 + 30, "Europe/Berlin");
    assert.equal(minutesOfDay(instant, "Europe/Berlin"), 8 * 60 + 30);
    assert.equal(toDayKey(instant, "Europe/Berlin"), "2026-09-07");
  });

  it("round-trips across a DST spring-forward boundary", () => {
    const instant = zonedTimeToInstant("2026-03-29", 14 * 60, "Europe/Berlin");
    assert.equal(minutesOfDay(instant, "Europe/Berlin"), 14 * 60);
  });

  it("parses and formats HH:mm", () => {
    assert.equal(parseTimeOfDay("07:30"), 450);
    assert.equal(parseTimeOfDay("nope", 60), 60);
    assert.equal(parseTimeOfDay("25:00", 60), 60);
    assert.equal(formatTimeOfDay(450), "07:30");
  });

  it("handles windows that wrap past midnight", () => {
    assert.equal(isWithinWindow(23 * 60, 22 * 60, 7 * 60), true);
    assert.equal(isWithinWindow(3 * 60, 22 * 60, 7 * 60), true);
    assert.equal(isWithinWindow(12 * 60, 22 * 60, 7 * 60), false);
  });

  it("does day arithmetic over month and year boundaries", () => {
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
    assert.equal(addDays("2026-12-31", 1), "2027-01-01");
    assert.equal(daysBetween("2026-09-01", "2026-09-08"), 7);
  });
});

describe("goal", () => {
  it("scales with weight and activity", () => {
    const sedentary = suggestDailyGoal({ weightKg: 70, activityLevel: "LOW" });
    const active = suggestDailyGoal({ weightKg: 70, activityLevel: "VERY_ACTIVE" });
    assert.ok(active > sedentary);
    assert.ok(sedentary >= 2000 && sedentary <= 2600);
  });

  it("falls back sensibly without a weight", () => {
    assert.ok(suggestDailyGoal({}) >= 2000);
  });

  it("clamps extremes", () => {
    assert.equal(clampDailyGoal(50), 1000);
    assert.equal(clampDailyGoal(99_999), 6000);
  });
});

describe("progress", () => {
  it("never renders above 100%", () => {
    const progress = computeProgress(3000, 2500);
    assert.equal(progress.percentage, 100);
    assert.equal(progress.rawPercentage, 120);
    assert.equal(progress.remaining, 0);
    assert.equal(progress.completed, true);
  });

  it("computes the ordinary case", () => {
    const progress = computeProgress(1500, 2500);
    assert.equal(progress.percentage, 60);
    assert.equal(progress.remaining, 1000);
    assert.equal(progress.completed, false);
  });
});

describe("pace", () => {
  it("expects nothing before waking and everything by the end", () => {
    const window = paceWindow(7 * 60, 23 * 60);
    assert.equal(expectedFraction(5 * 60, window), 0);
    assert.equal(expectedFraction(6 * 60 + 59, window), 0);
    assert.equal(expectedFraction(22 * 60 + 30, window), 1);
    assert.equal(expectedFraction(23 * 60 + 30, window), 1);
  });

  it("rises monotonically through the day", () => {
    const window = paceWindow(7 * 60, 23 * 60);
    let previous = -1;
    for (let hour = 7; hour <= 22; hour += 1) {
      const value = expectedFraction(hour * 60, window);
      assert.ok(value >= previous, `expected monotonic at ${hour}:00`);
      previous = value;
    }
  });

  it("finishes the curve before bedtime", () => {
    const window = paceWindow(7 * 60, 23 * 60);
    assert.equal(window.endMinute, 22 * 60);
  });
});

const basePreferences = {
  enabled: true,
  interval: 60,
  startTime: "08:00",
  endTime: "22:00",
  quietHoursStart: "22:00",
  quietHoursEnd: "07:00",
  adaptive: true,
};

function context(overrides: Partial<ReminderContext> = {}): ReminderContext {
  return {
    now: new Date("2026-09-07T10:00:00Z"),
    timezone: "UTC",
    goal: 2500,
    consumed: 1000,
    lastDrinkAt: new Date("2026-09-07T09:30:00Z"),
    wakeTime: "07:00",
    sleepTime: "23:00",
    defaultServing: 250,
    preferences: basePreferences,
    ...overrides,
  };
}

describe("reminder engine", () => {
  it("still rings on schedule when the user is keeping pace", () => {
    const plan = evaluateReminder(context());
    assert.equal(plan.state, "ON_TRACK");
    assert.equal(plan.shouldNotify, true);
  });

  it("counts the next reminder from the one that just fired", () => {
    const now = new Date("2026-09-07T10:40:00Z");
    const plan = evaluateReminder(context({ now, lastReminderAt: now }));
    assert.equal(plan.nextReminderAt?.toISOString(), "2026-09-07T11:40:00.000Z");
  });

  it("makes an overdue reminder due now rather than receding", () => {
    const now = new Date("2026-09-07T12:00:00Z");
    const plan = evaluateReminder(context({ now }));
    assert.equal(plan.nextReminderAt?.getTime(), now.getTime());
  });

  it("flags falling behind and asks for a small pour", () => {
    const plan = evaluateReminder(context({ consumed: 100 }));
    assert.equal(plan.state, "FALLING_BEHIND");
    assert.equal(plan.shouldNotify, true);
    assert.ok(plan.suggestedAmount >= 100 && plan.suggestedAmount <= 600);
    assert.ok(!/fail|unhealthy|dehydrated/i.test(plan.headline + plan.body));
  });

  it("notices a long gap since the last drink", () => {
    const plan = evaluateReminder(
      context({ consumed: 1400, lastDrinkAt: new Date("2026-09-07T06:00:00Z") }),
    );
    assert.equal(plan.state, "INACTIVE");
    assert.equal(plan.shouldNotify, true);
  });

  it("does not nudge again right after a drink", () => {
    const now = new Date("2026-09-07T10:00:00Z");
    const plan = evaluateReminder(
      context({ now, consumed: 100, lastDrinkAt: new Date("2026-09-07T09:58:00Z") }),
    );
    assert.ok(plan.nextReminderAt);
    const gapMinutes = (plan.nextReminderAt!.getTime() - now.getTime()) / 60_000;
    assert.ok(gapMinutes >= 15, `expected a breather, got ${gapMinutes} minutes`);
  });

  it("tightens the interval when behind and relaxes it when on track", () => {
    const lastDrinkAt = new Date("2026-09-07T09:30:00Z");
    const behind = evaluateReminder(context({ consumed: 100, lastDrinkAt }));
    const onTrack = evaluateReminder(context({ consumed: 1000, lastDrinkAt }));
    assert.ok(behind.nextReminderAt && onTrack.nextReminderAt);
    assert.ok(behind.nextReminderAt!.getTime() < onTrack.nextReminderAt!.getTime());
  });

  it("rests during quiet hours instead of nudging", () => {
    const plan = evaluateReminder(
      context({ now: new Date("2026-09-07T23:30:00Z"), consumed: 500 }),
    );
    assert.equal(plan.state, "RESTING");
    assert.equal(plan.shouldNotify, false);
  });

  it("celebrates a met goal and stops scheduling", () => {
    const plan = evaluateReminder(context({ consumed: 2600 }));
    assert.equal(plan.state, "GOAL_MET");
    assert.equal(plan.nextReminderAt, null);
    assert.equal(plan.shouldNotify, false);
  });

  it("schedules the next nudge inside the reminder window", () => {
    const plan = evaluateReminder(
      context({ now: new Date("2026-09-07T21:50:00Z"), consumed: 500, lastDrinkAt: null }),
    );
    assert.ok(plan.nextReminderAt);
    const minute = minutesOfDay(plan.nextReminderAt!, "UTC");
    assert.ok(minute >= 8 * 60 && minute < 22 * 60, `landed at ${formatTimeOfDay(minute)}`);
  });

  it("respects a user who turned reminders off", () => {
    const plan = evaluateReminder(
      context({ consumed: 100, preferences: { ...basePreferences, enabled: false } }),
    );
    assert.equal(plan.nextReminderAt, null);
    assert.equal(plan.shouldNotify, false);
  });
});

describe("streaks", () => {
  const outcomes = [
    { date: "2026-09-01", goalCompleted: true },
    { date: "2026-09-02", goalCompleted: true },
    { date: "2026-09-03", goalCompleted: false },
    { date: "2026-09-04", goalCompleted: true },
    { date: "2026-09-05", goalCompleted: true },
    { date: "2026-09-06", goalCompleted: true },
  ];

  it("keeps a streak alive while today is still in progress", () => {
    const summary = computeStreaks(outcomes, "2026-09-07");
    assert.equal(summary.current, 3);
    assert.equal(summary.todayPending, true);
  });

  it("counts today once it is completed", () => {
    const summary = computeStreaks(
      [...outcomes, { date: "2026-09-07", goalCompleted: true }],
      "2026-09-07",
    );
    assert.equal(summary.current, 4);
    assert.equal(summary.todayPending, false);
  });

  it("tracks the longest run independently of the current one", () => {
    assert.equal(computeStreaks(outcomes, "2026-09-09").longest, 3);
  });

  it("offers a fresh start after a missed day", () => {
    const summary = computeStreaks(
      [...outcomes, { date: "2026-09-07", goalCompleted: false }],
      "2026-09-08",
    );
    assert.equal(summary.current, 0);
    assert.equal(summary.freshStart, true);
    assert.match(streakMessage(summary), /fresh start/i);
  });

  it("does not tell a brand-new account that yesterday went wrong", () => {
    const summary = computeStreaks([{ date: "2026-09-07", goalCompleted: false }], "2026-09-07");
    assert.equal(summary.freshStart, false);
    assert.match(streakMessage(summary), /start a streak/i);
  });
});

describe("insights", () => {
  it("says nothing until there is enough history", () => {
    assert.deepEqual(
      generateInsights({
        summaries: [{ date: "2026-09-06", totalAmount: 2000, goal: 2500, goalCompleted: false }],
        hourlyTotals: new Array(24).fill(0),
        today: "2026-09-07",
      }),
      [],
    );
  });

  it("finds the peak drinking window", () => {
    const hourlyTotals = new Array(24).fill(10);
    for (let hour = 9; hour < 13; hour += 1) hourlyTotals[hour] = 400;
    const insights = generateInsights({
      summaries: Array.from({ length: 6 }, (_, index) => ({
        date: addDays("2026-09-07", -index - 1),
        totalAmount: 2400,
        goal: 2500,
        goalCompleted: true,
      })),
      hourlyTotals,
      today: "2026-09-07",
    });
    assert.ok(insights.some((insight) => insight.id === "peak-window"));
    assert.ok(insights.every((insight) => !/dehydrat|diagnos|unhealthy/i.test(insight.title)));
  });
});

describe("alert", () => {
  it("defaults to ten beeps", () => {
    assert.equal(DEFAULT_ALERT_BEEPS, 10);
  });

  it("grows the duration with the number of beeps", () => {
    assert.ok(alertDurationMs(20) > alertDurationMs(10));
    assert.ok(alertDurationMs(10) > alertDurationMs(1));
  });

  it("does not count a trailing gap after the last beep", () => {
    // One beep is its own audible span, with no silence after it.
    assert.equal(alertDurationMs(1, "classic"), 130);
  });

  it("keeps the default alert around three seconds", () => {
    const seconds = alertDurationMs(DEFAULT_ALERT_BEEPS) / 1000;
    assert.ok(seconds > 2.5 && seconds < 3.5, `got ${seconds}s`);
  });

  it("clamps out-of-range and nonsense values", () => {
    assert.equal(clampBeeps(0), 1);
    assert.equal(clampBeeps(999), MAX_ALERT_BEEPS);
    assert.equal(clampBeeps(7.4), 7);
    assert.equal(clampBeeps(Number.NaN), DEFAULT_ALERT_BEEPS);
  });

  it("describes the alert in words the settings screen can show", () => {
    assert.match(describeAlert(10), /^10 beeps · about \d/);
    assert.match(describeAlert(1), /^1 beep · about/);
  });

  it("falls back to the default tone for an unknown id", () => {
    assert.equal(alertTone("nonsense").id, DEFAULT_ALERT_TONE);
    assert.equal(alertTone(null).id, DEFAULT_ALERT_TONE);
  });

  it("gives every tone a distinct rhythm, not just a distinct pitch", () => {
    // Rhythm is what keeps tones apart through a pocket, or for anyone who
    // can't easily tell two pitches apart.
    const rhythms = ALERT_TONES.map((tone) => `${tone.cycleMs}:${tone.steps.length}`);
    assert.equal(new Set(rhythms).size, ALERT_TONES.length);
  });

  it("measures duration per tone, since their cadences differ", () => {
    for (const tone of ALERT_TONES) {
      assert.equal(
        alertDurationMs(4, tone.id),
        3 * tone.cycleMs + beepSpanMs(tone),
        `duration wrong for ${tone.id}`,
      );
    }
    assert.ok(alertDurationMs(10, "chime") > alertDurationMs(10, "classic"));
  });
});

describe("vibration", () => {
  it("alternates buzz and pause, starting with a buzz", () => {
    const pattern = vibrationPattern(3, "classic");
    // Three beeps: buzz, pause, buzz, pause, buzz — no trailing pause.
    assert.equal(pattern.length, 5);
    assert.deepEqual(pattern, [130, 170, 130, 170, 130]);
  });

  it("buzzes once per note for a multi-note tone", () => {
    const pattern = vibrationPattern(1, "rising");
    // Three ascending notes with 5 ms between them merge into one pulse.
    assert.ok(pattern.length >= 1);
    assert.equal(pattern.reduce((sum, value) => sum + value, 0) > 0, true);
  });

  it("merges overlapping notes into one pulse rather than a stutter", () => {
    // The chime's second note begins before the first has finished.
    const pattern = vibrationPattern(1, "chime");
    assert.equal(pattern.length, 1, `expected one continuous pulse, got ${pattern}`);
    assert.equal(pattern[0], beepSpanMs(alertTone("chime")));
  });

  it("keeps the buzz inside the sound it accompanies", () => {
    for (const tone of ALERT_TONES) {
      const beeps = 5;
      const total = vibrationPattern(beeps, tone.id).reduce((sum, value) => sum + value, 0);
      assert.ok(
        total <= alertDurationMs(beeps, tone.id) + 1,
        `${tone.id}: vibration ${total}ms outlasts audio ${alertDurationMs(beeps, tone.id)}ms`,
      );
    }
  });

  it("scales with the number of beeps", () => {
    assert.ok(vibrationPattern(10, "classic").length > vibrationPattern(3, "classic").length);
  });

  it("clamps a nonsense beep count like the audio does", () => {
    assert.deepEqual(vibrationPattern(0, "classic"), vibrationPattern(1, "classic"));
  });
});

describe("units", () => {
  it("formats litres and millilitres", () => {
    assert.equal(formatVolume(1500, "ML"), "1.5 L");
    assert.equal(formatVolume(750, "ML"), "750 ml");
    assert.equal(formatServing(250, "ML"), "250 ml");
  });

  it("converts to ounces for display only", () => {
    assert.equal(formatServing(250, "OZ"), "8 oz");
    assert.equal(formatVolume(2500, "OZ"), "84.5 oz");
  });

  it("rounds suggestions to pourable numbers", () => {
    assert.equal(roundToServing(237), 250);
    assert.equal(roundToServing(0), 50);
  });
});
