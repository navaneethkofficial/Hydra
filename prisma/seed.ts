/**
 * Seeds a demo account with about six weeks of believable history.
 *
 * The generated pattern is deliberately human — a strong morning, a dip after
 * 6 PM, weaker Fridays, and a few missed days — so the insights and reminder
 * engine have something real to work against in development.
 *
 * Run with `npm run db:seed`. Safe to re-run: it resets the demo user's data.
 */

import { PrismaClient } from "@prisma/client";
import { randomBytes, scrypt } from "node:crypto";

const prisma = new PrismaClient();

const DEMO_EMAIL = "alex@hydra.app";
const DEMO_PASSWORD = "hydrate123";
const TIMEZONE = "UTC";
const DAILY_GOAL = 2500;
const HISTORY_DAYS = 45;

/** Relative likelihood of a drink landing in each hour of the day. */
const HOURLY_SHAPE = [
  0, 0, 0, 0, 0, 0, 0.4, 1.1, 1.5, 1.6, 1.5, 1.2,
  1.3, 1.1, 0.9, 0.8, 0.7, 0.5, 0.35, 0.25, 0.15, 0.05, 0, 0,
];

const SERVINGS = [150, 250, 250, 300, 350, 500];

async function main() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: {
      email: DEMO_EMAIL,
      name: "Alex Rivera",
      passwordHash,
      timezone: TIMEZONE,
      onboardedAt: new Date(),
      profile: {
        create: {
          weightKg: 72,
          activityLevel: "MODERATE",
          dailyGoal: DAILY_GOAL,
          wakeTime: "07:00",
          sleepTime: "23:00",
          defaultServing: 250,
        },
      },
      reminderSettings: { create: { startTime: "07:00", endTime: "22:00" } },
    },
    update: { passwordHash, onboardedAt: new Date() },
  });

  // Idempotent: wipe this user's history before regenerating it.
  await prisma.waterLog.deleteMany({ where: { userId: user.id } });
  await prisma.dailySummary.deleteMany({ where: { userId: user.id } });

  const today = new Date();
  let logs = 0;

  for (let offset = HISTORY_DAYS - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setUTCDate(day.getUTCDate() - offset);
    const dayKey = day.toISOString().slice(0, 10);
    const weekday = day.getUTCDay();

    // A handful of days simply didn't happen — that is what real history is.
    if (offset > 0 && Math.random() < 0.11) {
      await upsertSummary(user.id, dayKey, 0, 0, null, null);
      continue;
    }

    // Fridays run lower; today is only partway through.
    const intent = weekday === 5 ? 0.72 : weekday === 0 || weekday === 6 ? 0.88 : 1.02;
    const dayTarget = DAILY_GOAL * intent * (0.85 + Math.random() * 0.3);
    // Today is only as far along as the clock says, so the dashboard opens on
    // a plausible mid-day state rather than a finished one.
    const partialDay = offset === 0 ? elapsedFractionOfDay(today) : 1;

    let total = 0;
    let count = 0;
    let first: Date | null = null;
    let last: Date | null = null;

    // `attempts` bounds the loop: on the current day most sampled hours are
    // still in the future, and those are skipped rather than ending the day.
    // Today's drinks can only have happened in hours that have already passed.
    const latestHour = offset === 0 ? today.getUTCHours() : 23;

    for (let attempts = 0; attempts < 80 && total < dayTarget * partialDay && count < 14; attempts += 1) {
      const hour = pickHour(latestHour);
      const at = new Date(day);
      at.setUTCHours(hour, Math.floor(Math.random() * 60), 0, 0);
      if (offset === 0 && at > today) continue;

      const amount = SERVINGS[Math.floor(Math.random() * SERVINGS.length)] ?? 250;
      await prisma.waterLog.create({
        data: {
          userId: user.id,
          amount,
          loggedAt: at,
          dayKey,
          source: Math.random() < 0.25 ? "REMINDER" : "QUICK_ADD",
        },
      });

      total += amount;
      count += 1;
      logs += 1;
      if (!first || at < first) first = at;
      if (!last || at > last) last = at;
    }

    await upsertSummary(user.id, dayKey, total, count, first, last);
  }

  console.info(`Seeded ${logs} drinks across ${HISTORY_DAYS} days.`);
  console.info(`Sign in as ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
}

async function upsertSummary(
  userId: string,
  date: string,
  totalAmount: number,
  logCount: number,
  firstLogAt: Date | null,
  lastLogAt: Date | null,
) {
  const data = {
    totalAmount,
    goal: DAILY_GOAL,
    percentage: Math.min(100, Math.round((totalAmount / DAILY_GOAL) * 100)),
    goalCompleted: totalAmount >= DAILY_GOAL,
    logCount,
    firstLogAt,
    lastLogAt,
  };
  await prisma.dailySummary.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, ...data },
    update: data,
  });
}

/** How far through the 07:00–22:00 awake window the current moment is. */
function elapsedFractionOfDay(now: Date): number {
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  return Math.min(1, Math.max(0.05, (minutes - 7 * 60) / (15 * 60)));
}

/** Samples an hour from the daily shape, no later than `latestHour`. */
function pickHour(latestHour = 23): number {
  const shape = HOURLY_SHAPE.slice(0, latestHour + 1);
  const total = shape.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return Math.min(latestHour, 7);

  let target = Math.random() * total;
  for (let hour = 0; hour <= latestHour; hour += 1) {
    target -= shape[hour] ?? 0;
    if (target <= 0) return hour;
  }
  return Math.min(latestHour, 12);
}

function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error
        ? reject(error)
        : resolve(`scrypt$16384$8$1$${salt.toString("base64")}$${key.toString("base64")}`),
    );
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
