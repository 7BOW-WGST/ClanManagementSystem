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
- [ ] Member-excluded fields (kick reasons, notes, audit, suppressed sources) are filtered server-side.
- [ ] All key scenarios below produce the expected result.

---

## Scenario expected outcomes

- **Rejoin (join → leave/kick → join):** core rank, veteran, and all section memberships are gone after leave; on rejoin everything starts from scratch. Nickname history and awards persist. Sections require a fresh squadron/section event.
- **Unknown date:** an event with `event_date_precision = unknown` is shown as undated and never becomes the current value over a dated event.
- **Backdated entry:** inserting an event with an older `event_date` fills history without changing the current value, unless it is later than the current value's date.
- **Borrowed account:** a `borrowed` link does not grant WT section membership; it may coexist with the owner's `main`/`alt`.
- **Bad-link correction:** a wrongly linked account can be corrected (V2) or removed; derived state re-computes.
- **Source conflict (manual vs auto):** manual wins at equal recency; a newer automated value does not override a manual one; an older manual value does not override newer reality.
- **Override withdrawal:** withdrawing a manual override reverts the effective value to the retained automated value.

---

## Minimum manual-entry views/forms

- **Member timeline** — chronological events for a member (lifecycle, nickname, rank, veteran, awards).
- **Account timeline** — account identity, name history, links, and section events.
- **Date input with precision** — pick day / month / year / unknown; never fabricate a precise day.
- **Correction action** — correct a value in place (V2), with audit.
- **Withdrawal action** — withdraw a manual override (V5).
- **Award grant form** — choose award/tier, member, date; require a reason when the award demands it.
- **Conflict view** — show the effective value, the suppressed source, and a drill-down to suppressed data.
