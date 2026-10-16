# Clan Management System — Roadmap

This is the working plan for implementation. It turns the milestones in [`ACCEPTANCE.md`](./ACCEPTANCE.md) into small, demoable **vertical slices**, and defers the domain decisions and schema to [`DECISIONS.md`](./DECISIONS.md) and [`DATA_MODEL.md`](./DATA_MODEL.md).

## Model

- **Milestone** = one of the six ACCEPTANCE steps; a meaningful, verifiable phase.
- **Slice** = one thin end-to-end increment, demoable on its own:
  `migration + typed Kysely query → route/action → minimal SSR form/view → server-side validation + authorization → tests → docs if a decision/schema changed`.
- Progress is measured per slice: a working page/action plus green tests.

### Definition of Done (per slice)

- `bun run typecheck` and `bun test` pass.
- Migrations (and seed, if any) are added and idempotent from a clean database.
- Every mutating route validates input server-side **and** checks the role (Member cannot mutate).
- The feature is demoable in the running app.
- Affected docs under `docs/development/` are updated when a decision or schema changed.

### Testing

- `bun:test` only (no extra packages).
- **Unit tests** for pure logic: the CS1 projection, date/precision handling.
- **Integration tests** against a dedicated test database (derived from `DATABASE_URL` as `<db>_test`, or `TEST_DATABASE_URL`): migrations, seed idempotency, DB constraints, ordering, concurrency.

## Milestones and slices

### M0 — Walking skeleton (ACCEPTANCE Step 1)

- **0.1 App shell** — Hono SSR entry, Bootstrap-CDN layout, `GET /` health/index page; bind `HOST`/`PORT` (`127.0.0.1:3000`); graceful shutdown.
- **0.2 Config + DB** — `src/config.ts` validates `DATABASE_URL` (syntax vs connectivity, fail fast, no secrets); `src/db.ts` builds Kysely and closes the pool on exit.
- **0.3 Migration + seed infra** — Kysely `Migrator` runner, seed runner, scripts (`dev`/`migrate`/`seed`/`test`), migration naming.
- **0.4 First migration + seed** — `members` and `sections` tables; seed the sections catalog.
- **0.5 Tests + CI** — test-DB harness, smoke + idempotency tests, CI `test` job (Postgres service).

### M1 — Members core (ACCEPTANCE Step 2)

- **1.1 Members list + create** — list (empty state) and create form; server-side validation; dev role selector + `requireRole`.
- **1.2 Membership lifecycle** — `member_lifecycle_events` (join/leave/kick); derive current status; member detail.
- **1.3 Nickname history** — `member_nickname_events`; current nickname; timeline with date-precision input.
- **1.4 Projection module** — CS1 + partial-date handling as a shared, unit-tested module (verification cases 1–2).

### M2 — Accounts and linking (ACCEPTANCE Step 3)

- **2.1 Accounts CRUD** — per platform, text external IDs, unique `(platform, platform_id)`.
- **2.2 Link history** — unified `account_link_events` (link/unlink/relation_change); derived links; WT relation constraints.
- **2.3 Account merge** — canonical selection, re-point events, `account_merge_audit`.
- **2.4 Constraint tests** — integration tests (verification cases 5, 7, 8).

### M3 — Sections, ranks, statuses, awards (ACCEPTANCE Step 4)

- **3.1 Section membership** — sections + WT squadron membership events → derived section membership.
- **3.2 Core ranks** — seed rank catalog; join implies Elew; promotions/demotions (skip allowed); timeline.
- **3.3 Veteran** — veteran gained/removed events.
- **3.4 Awards** — seed award catalog; grant/revoke/upgrade via `target_event_id`; per-definition and per-tier-group limits.
- **3.5 Suspensions** — nullable end date, no-overlap constraint.

### M4 — Arma 3 and backfill UX (ACCEPTANCE Step 5)

- **4.1 Arma 3** — Arma 3 rank stream + Arma 3 section events.
- **4.2 Backfill flow** — person → nickname/join → accounts → history; search by old nicknames/IDs; pagination; conflict view (block vs warn).

### M5 — Verification (ACCEPTANCE Step 6)

- **5.1 Field filtering + final gate** — server-side exclusion of confidential fields; run all scenarios and the verification backlog as the Phase 1 exit criteria.

## Foundational items (built once, used throughout)

- **CS1 projection + shared read contract** — one module used by lists, detail pages, and forms (avoids duplicated rules and N+1 reads).
- **Authorization + validation helpers** — introduced with the first mutation (M1.1), used everywhere after.
- **Migration/seed infrastructure** — before any table (M0.3).

## Verification backlog (mapped to slices)

1. Manual/auto, event-date, correction variants → M1.4.
2. Day/month/year/unknown dates, future rejection, undated-only fallback → M1.4.
3. join → promotion → sections → leave/kick → rejoin (same-day) → M3.
4. Backdated add/correction/soft-delete across the membership cycle → M4.2.
5. Link/unlink per platform; `borrowed` grants no WT membership → M2.4.
6. Multiple grants, revoke a specific instance, tier upgrade/revoke → M3.4.
7. Concurrent two-`main`, limit-exceeding grants, overlapping suspensions → M2.4/M3.5.
8. Account merge with colliding links → M2.3.
9. Member direct POST rejected; confidential fields absent → M1.1/M5.1.
10. Migrate + seed twice without duplication or clobbering manual changes → M0.4/M0.5.

## Deferred (not Phase 1)

Arma 3 qualifications/specializations, statistics, operations, Discord automation, and the bot write contract (see [`DECISIONS.md`](./DECISIONS.md) Open Items).
