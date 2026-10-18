# Clan Management System — Acceptance Criteria & Example Histories

This document turns the Phase 1 order ([`DECISIONS.md`](./DECISIONS.md), P1) into testable outcomes. It lists per-step acceptance criteria, expected results for the key historical scenarios, and the minimum manual-entry views/forms.

---

## Per-step acceptance criteria

### Step 1 — Skeleton, configuration, typecheck, migrations

- [ ] App starts locally on `127.0.0.1:3000` and renders a page.
- [ ] `bun run typecheck` passes; CI runs on Ubuntu and Windows with a frozen lockfile.
- [ ] Missing/invalid `DATABASE_URL` fails fast with a clear message; pool closes cleanly on exit.
- [ ] A migration and a seed run idempotently from a clean database.

### Step 2 — Member, membership cycle, nickname history

- [ ] A member can be created and a `join` recorded; current status derives correctly.
- [ ] Nickname changes are recorded as events; current nickname derives from the latest.
- [ ] `leave`/`kick` ends core state (rank, veteran) and closes sections.

### Step 3 — Platform accounts and linkage history

- [ ] Accounts can be created per platform, linked/unlinked, with relation changes recorded.
- [ ] WT relation constraints hold (one `main`/`alt` per account; one `main` per member; `borrowed` unlimited).
- [ ] Duplicate `(platform, platform_id)` is rejected; accounts can be merged with history preserved.

### Step 4 — Sections, ranks, statuses, awards

- [ ] WT/Arma 3 section membership derives from the respective events.
- [ ] Core and Arma 3 ranks derive independently from the shared catalog.
- [ ] Awards grant/revoke/upgrade work; per-member limits and tier upgrades enforced.

### Step 5 — Arma 3 history and data entry

- [ ] Historical backfill of Arma 3 section data works with partial dates.
- [ ] Minimum views/forms below are usable for bulk historical entry.

### Step 6 — Permission and historical-scenario verification

- [x] Member-excluded fields (kick reasons, notes, audit, suppressed sources) are filtered server-side.
- [x] All key scenarios below produce the expected result.

---

## Scenario expected outcomes

- **Rejoin (join → leave/kick → join):** after leave, core rank, veteran, Arma 3 rank, all section memberships, and suspensions are gone; on rejoin everything starts from scratch. Nickname history, account links, and awards persist. Sections require a fresh squadron/section event. A join implies Elew.
- **Unknown date:** an event with `event_date_precision = unknown` is shown as undated and never becomes the current value over a dated event.
- **Backdated entry:** inserting an event with an older `event_date` fills history without changing the current value, unless it is later than the current value's date.
- **Borrowed account:** a `borrowed` link does not grant WT section membership; it may coexist with the owner's `main`/`alt`.
- **Bad-link correction:** a wrongly linked account can be corrected or unlinked (MO1); derived state re-computes and history is preserved.
- **Source conflict (manual vs auto):** at an equal `event_date`, the `manual` value is shown and the `auto` value is suppressed; a later `event_date` (either source) wins over an earlier one.
- **Same-day ordering:** events on the same day order by `recorded_at`; a later insert supersedes an earlier one of the same date.

---

## Verification backlog

Concrete case sets to encode as tests before the projection is implemented:

1. All manual/auto, event-date, and correction variants (CS1/A2/H7).
2. Day, month, year, unknown dates; rejection of future dates; undated-only fallback.
3. join → promotion → sections → leave/kick → rejoin, including same-day events.
4. Backdated add, correction, and soft-delete that change the membership cycle (block vs warn).
5. Link and unlink for each platform; `borrowed` grants no WT membership.
6. Multiple grants of one award; revoking a specific instance; tier upgrade and revoke.
7. Concurrent attempts at two `main` links, limit-exceeding grants, and overlapping suspensions.
8. Account merge with colliding links, history preserved.
9. Member: direct POST rejected; confidential fields absent from responses.
10. Migrate + seed on a clean database, and again, without duplication or destroying manual changes.

---

## Minimum manual-entry views/forms

- **Member timeline** — chronological events for a member (lifecycle, nickname, rank, veteran, awards).
- **Account timeline** — account identity, name history, links, and section events.
- **Date input with precision** — pick day / month / year / unknown; never fabricate a precise day.
- **Correction action** — correct a value in place (MO1), with audit.
- **Award grant form** — choose award/tier, member, date; require a reason when the award demands it.
- **Conflict view** — show the effective value, the suppressed source, and a drill-down to suppressed data; list past-only constraint warnings.
