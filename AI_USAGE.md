# AI Usage


## Which AI tools I used

- Copilot (Claude Sonnet, GPT-5.6 Luna, etc.) for code scaffolding and
  drafting this file. I described the requirements, discussed the
  architecture and trade-offs first, then had it scaffold the project
  (schema, service, tests, UI). I also used it for debugging and
  refactoring, always verifying the output locally before committing.
- Gemini for discussing the schema, tech stack decisions, minor issues,
  and looking up commands (git, Docker).

## What I used AI for

- Discussing the overall approach before writing any code — e.g. comparing
  a seat-hold-with-TTL design against claiming the seat at payment time, and
  deciding which one actually matches the race scenario described in the
  brief.
- Scaffolding the initial project: `schema.sql`, the NestJS modules/
  controllers/DTOs, `BookingsService`, the seed script, the concurrent
  last-seat-race test, and a minimal React + Tailwind UI.
- Drafting this file and the structure of `README.md`.
- Debugging and refactoring when issues came up also always verified the
  output locally before committing.

## One place AI helped me move faster

Scaffolding the schema and the NestJS/React boilerplate (modules,
controllers, DTOs, page components) was significantly faster than writing
it by hand. This freed up most of my time budget to focus on and verify
the transaction/locking logic in BookingsService, which is the part that
actually needed careful thinking.

## One place I disagreed with / corrected AI output

Two concrete bugs came up when I actually ran the generated code, both from
things the AI didn't account for in its own scaffold:

1. **Missing `dotenv` load.** The generated `pool.ts` read
   `process.env.DATABASE_URL` directly, but nothing ever loaded the `.env`
   file into `process.env` — Node doesn't do this automatically. The
   `DATABASE_URL` was `undefined`, so `pg` fell back to connecting with no
   valid credentials, which surfaced as a confusing
   `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`
   error that had nothing obviously to do with env vars at first glance. I
   traced it back by checking what `pg` was actually trying to connect
   with, then fixed it by adding `dotenv` and `import 'dotenv/config'` at
   the top of `pool.ts`.

2. **`tsconfig.json` had `strict: true`, but the generated DTOs didn't
   account for it.** NestJS DTOs are populated by `class-transformer` at
   request time, not through a constructor, so TypeScript's
   `strictPropertyInitialization` check failed with
   `Property 'X' has no initializer and is not definitely assigned` on
   every DTO field. Fixed by adding definite-assignment assertions (`!`)
   to each field in `backend/src/bookings/dto/create-booking.dto.ts` and
   `pay-booking.dto.ts` - a known pattern for NestJS DTOs under `strict`
   mode, but it was inconsistent that the strict config and the DTO style
   were generated together without accounting for each other.

3. **Unhandled promise rejection in `main.ts`.** The generated bootstrap
   call (`bootstrap();`) didn't handle a rejected promise — if `NestFactory
   .create()` or `app.listen()` failed at startup (e.g. the database wasn't
   reachable), the process would fail silently as an unhandled rejection
   instead of logging a clear error and exiting. Caught by running
   `oxlint --type-aware` (`no-floating-promises` rule), which NestJS's own
   scaffold includes but the AI-generated code didn't satisfy. Fixed by
   adding `.catch()` with an explicit error log and `process.exit(1)`.


## What I'd change about my AI workflow next time

Run the generated code locally sooner, in smaller pieces,
instead of scaffolding the whole project before running any of it.
Both real bugs above would've surfaced after the very first file
instead of after everything was already written.

## How I verified the final implementation

- Ran `pnpm test`, including the concurrent last-seat-race test
  (`backend/test/last-seat-race.e2e-spec.ts`), multiple times to check for
  flakiness.
- Manually walked through all 4 required seed scenarios via the API/UI:
  available class, class with 3 confirmed, duplicate booking, payment
  failure.
- Read `bookings.service.ts` line by line asking "what happens if two
  requests hit this at the exact same instant" at each step involving
  shared state.
- Ran the app from a clean state (`docker compose down -v`, reinstall,
  migrate, seed) to make sure the README instructions actually work for
  someone starting from scratch, not just in my already-set-up environment.
- **Lint checks** - ran `pnpm lint` (Oxlint, from the NestJS scaffold)
  before submission. It caught one real issue (an unhandled promise
  rejection in `main.ts`), which I fixed.
