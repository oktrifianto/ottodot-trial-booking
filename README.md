# Ottodot Trial Booking

Trial class booking system: parents book a trial class for their child, pay
(mock), and admins see the confirmed roster.
Built for the Ottodot take-home and scope is trial booking only, no regular enrollment.

## Requirements

- **Node.js** 20+ (developed on v24 LTS)
- **pnpm** 9+ (`corepack enable` if you don't have it — Node ships corepack)
- **Docker** (with Docker Compose) — used to run Postgres only; the backend
  and frontend run natively, not in containers (see "Backend / design" for
  why)
- **Postgres** — you don't need it installed locally; `pnpm db:up` runs it
  in Docker

## How to run

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
pnpm install       # install dependencies for both backend and frontend
pnpm db:up         # starts Postgres in Docker
pnpm migrate       # applies schema.sql
pnpm seed          # inserts demo data (see console output for IDs)
pnpm dev           # runs backend (:3000) and frontend (:5173)
```

Run tests:
```bash
pnpm test          # includes the concurrent last-seat-race test
```

Tests share the same database as `pnpm dev` (kept simple on purpose), but a
`globalSetup` step (`backend/test/global-setup.ts`) clears out only the rows
the test suite itself creates before each run, so running tests repeatedly
never pollutes what you're demoing in the UI.

## What I built

- `POST /bookings` - create/select a trial booking for a child + class
- `POST /bookings/:id/pay` - mock payment step, records the result
- `GET /bookings/:id` - booking status
- `GET /classes` - list with seats left
- `GET /classes/:id/roster` - confirmed roster for a class
- A minimal React UI: booking page, payment page, roster page

## Time spent

Total: ~3h 23m (started 20:00 GMT+7, finished 23:23 GMT+7)

| Phase | Time |
|---|---|
| Brainstorming and planning | 15m |
| Schema design + monorepo + docker setup | 22m |
| Fix Postgres/Docker/environment issues | 21m |
| Schema, migrations, booking feature (BE+FE), tests | 1h1m |
| Fix test data cleanup issue | 12m |
| Debugging (env vars, TS strict mode) | 3m |
| Manual testing across UI & API, fix linter | 46m |
| README + AI_USAGE.md | 23m |

## Assumptions

- No auth: student/parent selection is by ID for demo purposes.
- Payment amount is a fixed placeholder.
- Classes always have capacity 4 per the brief, but capacity is still a column, not hardcoded.

## Backend / design

**Data model**: `parents` → `students` → `bookings` ← `trial_classes`, with
`payment_attempts` recorded separately from `bookings` so a failed payment can
be retried without losing history. See `backend/migrations/schema.sql` for the
full schema and comments.

**Booking statuses**: `pending_payment`, `confirmed`, `payment_failed`,
`cancelled` (with `cancel_reason = 'class_full'` when the last seat is lost to
another payer).

**Key endpoints / functions**: see "What I built" above; all booking logic
lives in `backend/src/bookings/bookings.service.ts`.

**Preventing duplicate bookings**: a partial unique index on
`bookings (student_id, class_id) WHERE status IN ('pending_payment','confirmed')`
— enforced at the database level, with an application-level check first so
the common case doesn't even hit the constraint.

**Handling payment failure**: the mock gateway is called *before* any
database transaction opens. A failed charge only updates the booking to
`payment_failed` — it never touches the seat count, and the booking can be
retried with a new payment attempt.

**Handling the last-seat race**: on a successful charge, `payBooking` opens a
transaction and runs `SELECT ... FOR UPDATE` on the class row before counting
confirmed bookings. This serializes concurrent payers for the same class —
whichever transaction acquires the lock first counts, decides, and commits;
the next one then recounts under its own lock and correctly sees the seat is
gone. See `backend/test/last-seat-race.e2e-spec.ts` for a test that fires 10
concurrent payments at a class with 1 seat left and asserts exactly 1
confirmation.

**Why this approach / trade-offs**: an alternative is a seat *hold* created
the moment a booking starts (with a TTL and a cleanup job), which gives a
better UX for the losing user (rejected up front instead of after "paying").
I chose the lock-at-payment approach instead because it needs no background
job and no extra state machine for expiring holds, at the cost of a losing
user only finding out after completing payment (their charge is then voided).
For a take-home-sized system, I judged that trade-off worth the simplicity.

**Which checks belong where**:

| Layer | Responsibility |
|---|---|
| UI | Disable "Book" when seats_left is 0 (UX only, not a guarantee) |
| Backend | Input validation, booking state machine, idempotency, payment flow |
| Database | Unique indexes (duplicate bookings, duplicate confirmed seats), row lock via `FOR UPDATE` |
| Background job | Not implemented — see "What I'd do next" |

## What I deliberately cut

- **Auth** — no login; student/parent selection is by ID, and there's no
  check that a booking's student belongs to a given parent. In production
  this would be parent auth + an authorization check on `POST /bookings`.
- **Seat holds with TTL** — see trade-off above.
- **Regular enrollment** — out of scope per the brief.
- **React Router** — 3 static pages, state-based navigation was enough.
- **Real payment gateway / webhooks** — mock only, as specified.

## What I'd monitor after release

- Rate of `cancelled` bookings with `cancel_reason = 'class_full'` — a spike
  suggests either popular classes need more capacity or the UI isn't
  reflecting seats_left in near-real-time.
- `payment_attempts` stuck in `authorized` (never reaching `captured` or
  `voided`) — would indicate a bug in the claim-seat transaction.
- Unique constraint violations reaching the application layer unexpectedly.
- p95 latency on `POST /bookings/:id/pay` — the `FOR UPDATE` lock means
  concurrent payers for the same class queue briefly by design; a growing
  queue would show up here.

## What I'd do next with more time

- Seat holds with a TTL + a cleanup job for abandoned `pending_payment`
  bookings.
- Parent auth and authorization checks.
- Idempotency handling at the HTTP layer more generally (not just payments).
- Payment webhook + reconciliation job for a real gateway.
- Structured logging around the claim-seat transaction for observability.
- Clean up unused `package.json` scripts and dependencies left over from
  initial scaffolding, and update linting (ESLint/Oxlint) and formatting (Prettier)
