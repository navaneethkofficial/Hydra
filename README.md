# Hydra

**Drink water. Without having to remember.**

A hydration companion built around one idea: most people already know they should
drink more water — the thing they actually need is to be reminded, at a moment
that makes sense, with logging that takes one tap and under two seconds.

```
Open → See progress → Tap drink → Done
```

---

## Quick start

```bash
cp .env.example .env          # then set AUTH_SECRET
npm install
npm run db:up                 # Postgres 16 on :5433 via Docker
npm run db:migrate            # apply migrations
npm run db:seed               # optional: a demo account with 45 days of history
npm run dev
```

Open <http://localhost:3000>. The seeded account is `alex@hydra.app` / `hydrate123`.

Generate a real secret for anything but local work:

```bash
openssl rand -base64 32
```

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit tests for the domain, validation, cookie policy and auth client (`node --test`, no database needed) |
| `npm run test:e2e` | Browser checks of the sign-in flow against a running app (see [End-to-end tests](#end-to-end-tests)) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint, including the React Compiler rules |
| `npm run db:up` / `db:migrate` / `db:seed` / `db:studio` | Database lifecycle |

---

## Architecture

The guiding rule is that **hydration logic never touches a framework, and the
framework never contains hydration logic.** Four layers, each depending only on
the one beneath it:

```
  app/            Routes, pages, API handlers  — HTTP and rendering only
    ↓
  server/services Use-cases: getToday, logWater, getInsights, updateSettings
    ↓
  server/repos    The only modules that import Prisma
    ↓
  lib/domain      Pure logic: pace, reminders, streaks, goals, insights, time
```

### `lib/domain` — the pure core

Zero dependencies. No React, no Prisma, no `process`, no I/O. Everything here is
a deterministic function of its arguments, which is why it can be unit-tested
without a database *and* imported by client components — the dashboard runs the
identical reminder engine locally between fetches, so the client and server can
never disagree about whether you are behind.

| Module | Responsibility |
|---|---|
| `time.ts` | The only bridge between UTC storage and the user's local day. DST-safe. |
| `goal.ts` | Suggests a daily target from weight, activity and climate. |
| `pace.ts` | The expected-progress curve — weighted by hour, learned from history. |
| `reminder-engine.ts` | Decides the reminder state, the message, the amount and the timing. |
| `alert.ts` | The alert tone table, its length maths, and the vibration pattern derived from the same rhythm. |
| `streak.ts` | Streaks and consistency, deliberately forgiving. |
| `insights.ts` | Behavioural observations, or `null` when the data doesn't support one. |
| `progress.ts`, `units.ts` | Percentages that never exceed 100; ml ⇄ oz presentation. |

### `server/` — orchestration

- **`http/route.ts`** — one wrapper that applies auth, rate limiting, Zod body
  validation and error mapping to every endpoint, so none of them can forget one.
- **`services/`** — the use-cases. A future mobile app talks to these through a
  thin transport; nothing in them knows about HTTP.
- **`repositories/`** — the only place Prisma appears. Every read is scoped by
  `userId` here rather than at each call site.
- **`auth/`** — scrypt password hashing, opaque and revocable server-side
  sessions, and `cookies.ts`, the one place auth-cookie attributes are decided.

### `app/` and `components/`

Route groups separate the three shells: `(marketing)` for the landing page,
`(auth)` for sign-in, `(app)` for the authenticated product. Each shell owns its
own guard, so no individual page repeats an auth check.

---

## The reminder engine

This is the part that makes the product something other than a tracker. It is
explicitly **not** `setInterval(notify, 2h)`.

Every evaluation takes the daily goal, what has been consumed, the time since the
last drink, the current time, the awake window, the user's typical drinking
pattern, and their preferred interval — and returns a **plan**:

```ts
{ state, expected, deficit, headline, body, suggestedAmount, nextReminderAt, shouldNotify }
```

**Expected progress is a curve, not a line.** A flat `goal ÷ hours` target expects
water the minute you wake and keeps expecting it while you are winding down for
bed. Instead the curve is weighted by hour of day, blended with the user's own
history once there are three days of it (confidence caps at 70% personal — one
unusual week should not lock anyone in), and it finishes an hour *before* bedtime.

**Four states, one of which is silence:**

| State | When | What happens |
|---|---|---|
| `ON_TRACK` | Keeping pace | Shown on the dashboard. No notification. |
| `FALLING_BEHIND` | Below 75% of the curve, by at least 200 ml | Gentle nudge, interval tightens to 0.6× |
| `INACTIVE` | No drink for 2× the interval | "Haven't had water in a while?", interval halves |
| `GOAL_MET` | Target reached | Celebrates once, stops scheduling, logging continues |
| `RESTING` | Asleep, or in quiet hours | Silent, by design |

Timing rules that matter as much as the states: it never fires within 20 minutes
of a drink you just logged, never outside your reminder window, never inside
quiet hours, and never at all if you turned reminders off.

No message in the engine blames anyone for a number — that is enforced by a test.

### The alert

A firing reminder also sounds an alarm-style alert and buzzes the device. Both
are synthesised — no audio files, so four tones cost no extra requests, nothing
to cache, and it works offline like the rest of the app.

A tone is declared as **data** in `lib/domain/alert.ts` — a rhythm of pitched
steps — rather than as code. One renderer plays all four, and the vibration
pattern is derived from the very same rhythm, so the buzz lands *on* the beep
rather than near it and the two cannot drift apart.

| Tone | Shape |
|---|---|
| **Classic** | One 880 Hz sine beep — a steady alarm clock. The default. |
| **Double** | Two quick square-wave chirps, like a digital watch. |
| **Chime** | Two overlapping bell notes, descending. The gentlest. |
| **Rising** | Three ascending notes. The hardest to ignore. |

They differ in **rhythm** as well as pitch — which is what keeps them apart
through a pocket, and for anyone who cannot easily tell two pitches apart. A
test asserts no two tones share a rhythm.

Length is the user's dial: 1–30 beeps, and because cadences differ the duration
shown in settings is computed per tone. Selecting a tone plays a two-beep taste
of it; the preview button plays the full alert exactly as a reminder will.

Sound and vibration are independent channels — either alone is a valid alert, so
a silenced phone still buzzes and a device that cannot vibrate still beeps. The
settings screen says plainly when the device supports neither, rather than
showing a toggle that quietly does nothing.

Browsers refuse to let a timer start audio or vibration unprompted, so the
channel is opened on the user's first tap on the dashboard — the log button they
were going to press anyway. When sound is on, the system notification is marked
`silent` so the OS chime does not double up. Alerts play while Hydra is open in a
tab; a service worker cannot use Web Audio, so a notification delivered to a
closed app falls back to the system sound, and the copy says so.

## Decisions worth knowing about

**Local days, UTC timestamps.** Every `WaterLog` stores a UTC instant *and* the
`dayKey` it belonged to in the user's timezone at write time. Day rollups
therefore never drift for travellers or across DST, and the timezone is refreshed
on every sign-in.

**Rollups are rebuilt, not incremented.** `DailySummary` is recomputed from its
logs on every write. A deleted drink, an edited goal and a replayed offline batch
all converge on the same correct number, so the rollup cannot drift from the logs
it summarises.

**History keeps the goal it was measured against.** Raising your target today does
not retroactively un-complete last Tuesday.

**Offline logging is a first-class path, not a fallback.** A tap writes to a
`localStorage` outbox and updates the UI immediately; the network is asked
afterwards. Each queued drink carries a `clientId` and the batch endpoint is
idempotent on it, so a flush that half-succeeded and gets retried cannot
double-count anyone's water.

**Sessions are opaque and revocable.** Only a SHA-256 of each session token is
stored, so a database dump yields no usable sessions, and logout, a password
change or a reset can revoke every device immediately.

**Progress never renders above 100%,** while logging past the goal keeps working.

**One validation contract, run twice.** The Zod schemas in
`server/validation/schemas.ts` validate every API body, and the forms run the
same schemas in the browser through `lib/form-validation.ts` before sending. A
message reads identically wherever it was produced, and the server stays the
authority.

**A sign-in isn't done until the session is confirmed.** A 200 from the login
endpoint proves the password was right, not that the browser kept the cookie.
`lib/auth-client.ts` follows every sign-in and registration with
`GET /api/auth/session`, and explains a dropped cookie instead of bouncing the
user back to the sign-in page without a word.

---

## Security

- scrypt password hashing (parameters stored with each hash, so they can be raised later)
- Opaque server-side sessions in `httpOnly`, `SameSite=Lax` cookies, marked
  `Secure` whenever the request arrived over HTTPS (see `AUTH_COOKIE_SECURE`)
- Sign-in responses are identical for an unknown email and a wrong password
  (`401 INVALID_CREDENTIALS`), and take comparable time, so an address cannot be
  enumerated
- Forms post with `method="post"` and keep their submit button disabled until
  the page has hydrated, so credentials can never be sent as URL parameters
- Zod validation on every request body and query
- Fixed-window rate limiting on auth, password reset and writes
- Every hydration query scoped by `userId` in the repository layer
- Single-use, hashed, 30-minute password reset tokens
- Google sign-in verifies OAuth `state` and refuses unverified email addresses
- `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` and a
  `Permissions-Policy` set on every response

---

## Accessibility

Semantic landmarks and a skip link; a visible focus ring on everything focusable;
44px minimum tap targets; `aria-live` on the values that change; labels wired to
controls through one `<Field>` component so they cannot be forgotten; state shown
by shape and text as well as colour (a missed day is an empty dashed ring, not a
red one); and every animation disabled under `prefers-reduced-motion`.

---

## PWA

Installable with a web manifest, maskable icons and app shortcuts. The maskable
icons come from `public/icons/icon-maskable.svg`, which has a full-bleed
background and keeps the drop well inside the safe zone. Re-render them with
`node scripts/render-icons.mjs` after editing the SVG. The service
worker keeps the app shell available offline and routes notification clicks — but
deliberately never caches `/api`, because a stale hydration number is worse than
an honest offline screen. Offline *writes* are handled by the outbox instead.

Notification permission is only ever requested from a deliberate tap, after the
benefit has been explained.

---

## Optional configuration

| Variable | Effect |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Shows and enables "Continue with Google" |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Registers a Web Push subscription after permission is granted |
| `APP_URL` | Base URL used for OAuth redirects and reset links |
| `AUTH_COOKIE_SECURE` | `auto` (default), `always` or `never` (`true`/`false` also accepted). Controls the `Secure` attribute on auth cookies, as below |

### `AUTH_COOKIE_SECURE`

Browsers silently drop a `Secure` cookie set over plain HTTP from any host other
than `localhost`. With the default, `auto`, auth cookies are `Secure` exactly
when the request arrived over HTTPS, read from `x-forwarded-proto`. Next.js sets
that header itself, and TLS-terminating proxies set it to `https`. That covers:

- local development and `npm start` on `localhost`;
- a production build opened from a phone or another machine over
  `http://<lan-ip>`;
- a real deployment behind HTTPS, where cookies are always `Secure`.

Use `always` if your proxy terminates TLS but doesn't forward
`x-forwarded-proto`. Use `never` only for an HTTP-only setup where `auto`
can't tell. An unrecognised value stops the server at boot.

Reminders work without either: while a tab is open, the client schedules them
from the same engine the server uses.

---

## End-to-end tests

`e2e/auth.e2e.ts` drives the sign-in form in a real browser:

- empty fields show inline messages without calling the API;
- a wrong password is explained;
- a correct one signs in;
- a dropped session cookie produces a message instead of a silent bounce;
- the form can't be submitted before it hydrates;
- the session cookie is `Secure` exactly when the app is served over HTTPS.

```bash
npm run dev                                          # or: npm run build && npm start
E2E_BASE_URL=http://localhost:3000 npm run test:e2e
```

It uses the Chrome installed on the machine (`CHROME_PATH` selects another
Chromium binary). Each run registers a throwaway `@hydra.test` account and
deletes it afterwards. Point `E2E_BASE_URL` at a LAN address
(`http://192.168.x.x:3000`) to check the "production build over HTTP" case.
Sign-in is rate limited to 10 attempts per 5 minutes per IP, so back-to-back
runs may need a short pause.

---

## What was deliberately left out

Password reset emails are logged in development rather than sent — the token
flow, expiry and single use are all implemented, but wiring a transactional mail
provider is a deployment decision. Likewise, push *delivery* needs VAPID keys and
a scheduler; the subscription endpoint and service-worker handler are in place
for it.

Everything measured against one question: *does this make it easier to
consistently drink water?* Social feeds, badge collections and configuration
screens did not survive it.
