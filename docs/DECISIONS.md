# Clan Management System — Domain & Architecture Decisions

This log records the domain-model and architecture decisions that resolve the open questions raised during the pre-implementation review. It accompanies [`REQUIREMENTS.md`](../REQUIREMENTS.md) (product scope) and [`AGENTS.md`](../AGENTS.md) (coding standards). Where this document is more specific, it takes precedence at implementation time; product scope remains in `REQUIREMENTS.md`.

**Status values:** `Accepted` (agreed, ready to implement), `Open` (undecided), `Superseded` (replaced by a later decision).

The current state of everything is **derived from an append-only event log**; the only explicitly time-bounded record is a section suspension (see S1). Supported runtime versions: **Bun >= 1.4**, **PostgreSQL 18** (P2).

---

## 1. History Model (H)

### H1 — Event-sourced history
**Status:** Accepted
**Decision:** All changes are recorded as append-only events, each with a single `event_date`; current state is derived.
**Event kinds:** join / leave / kick; nickname change; promotion; award grant / revoke / upgrade; veteran gained / lost; account created / relation changed / removed; squadron membership; section membership; Discord group membership; Steam group membership.
**Alternatives:** per-attribute time-bounded interval rows (rejected — ambiguous "no end date" semantics and complex in-place updates).

### H2 — Interval end bounds
**Status:** Superseded
Superseded by H1/S1. Interval bounds only apply to suspensions.

### H3 — Open vs unknown end date
**Status:** Superseded
Superseded by H1. Derived end dates come from the next event's date; there is no stored end date outside suspensions.

### H4 — Overlaps
**Status:** Accepted
**Decision:** Overlap constraints apply only to suspensions; overlapping suspensions for the same member + section are disallowed.
**Rationale:** every other attribute derives its end from the next event, so overlaps cannot occur by construction.
**Alternatives:** allow overlaps (rejected — ambiguous active state).

### H5 — Same-day ordering
**Status:** Accepted
**Decision:** Multiple events on the same date are ordered by insertion (`created_at`, then `id`); the later one wins.

### H6 — Backdating
**Status:** Accepted
**Decision:** Events store `event_date` (real-world) separately from `recorded_at` (system). A backdated event is inserted as-is; derived state recomputes on read. Ordering is validated and contradictions are flagged for admin review, not blocked.
**Rationale:** with event sourcing, backdating is a pure insert; nothing needs rewriting.
**Alternatives:** block backdated inserts (rejected — historical backfill is a core Phase 1 requirement).

### H7 — Revision and priority variants
**Status:** Accepted
**Decision:**
- **V1** auto → add manual: manual wins, automated value retained.
- **V2** manual → edit manual: newest wins, old value discarded (a correction).
- **V3** manual → add manual: newest wins, old value retained (new information).
- **V4** auto → auto append: newest automated value is appended and retained.
- **V5** manual → withdraw: override removed, retained automated value becomes effective again.
- Date-only and value fixes are treated as **V2 corrections**; no history is preserved for clerical-error fixes.
**Alternatives:** fully immutable audit of every edit (rejected — overkill for clerical fixes).

### H8 — Validity vs recorded dates
**Status:** Accepted
**Decision:** Every event keeps `event_date` (real-world) and `recorded_at` (system), plus `source`.

### H9 — Partial and unknown dates
**Status:** Accepted
**Decision:** `event_date` may be partial (year, or year + month) or unknown. Unknown dates sort last and are excluded from strict chronological comparisons; behavior is documented.

### H10 — Per-domain event tables
**Status:** Accepted
**Decision:** Events are stored in typed per-domain tables (member, nickname, promotion, award, veteran, account, squadron, section, Discord, Steam).
**Rationale:** strong Kysely typing, explicit and flat; avoids JSON payloads.
**Alternatives:** a single generic events table with a JSON payload (rejected — weak typing).

### H11 — Derive on read
**Status:** Accepted
**Decision:** Current state is computed from events on read; no materialized snapshots in Phase 1.
**Alternatives:** materialized current-state tables (deferred — may revisit if performance requires).

---

## 2. Change Auditing & Priority (A)

### A1 — Override granularity
**Status:** Accepted
Manual overrides apply at the field / derived-value level, not to whole entities.

### A2 — Manual priority
**Status:** Accepted
Manual values beat automated values until explicitly withdrawn; overrides do not expire.

### A3 — Withdrawal
**Status:** Accepted
Withdrawing an override removes it and reverts to the retained automated value (V5).

### A4 — Conflicting manual values
**Status:** Accepted
Latest `recorded_at` wins; both entries are retained (V3).

### A5 — Dashboard transparency
**Status:** Accepted
The dashboard shows the effective value plus a "lower-priority source suppressed" indicator with a drill-down to suppressed data.

### A6 — Audit fields
**Status:** Accepted
Records carry `source`, `created_by`, `created_at`, `reason`, and `supersedes_id`. Manual edits are treated as made by Owner (the role-selector limitation is dropped).

### A7 — Automated updates
**Status:** Accepted
Newer automated values are appended and retained (V4); the effective value is the newest automated value unless a manual override exists.

---

## 3. Members, Accounts & Sections (R)

### R1 — Relation is a link property
**Status:** Accepted
`main` / `alt` / `borrowed` describes the member → War Thunder account link, not the account itself. These relation types apply to War Thunder accounts only.
**Rationale:** the same account can be a main for one member and borrowed by another.
**Alternatives:** relation stored on the account (rejected — cannot express multi-member use).

### R2 — Ownership and relation types
**Status:** Open
Whether `is_owner` is needed, and the final set of account relation types, is deferred to implementation.

### R3 — Relation constraints
**Status:** Accepted
A War Thunder account may have any number of `borrowed` links and at most one `main` / `alt` designation; `main` and `alt` are mutually exclusive.
**Valid:** main of A + borrowed by B, C; alt of A + borrowed by B.
**Invalid:** main of A + alt of B.

### R4 — Provisional accounts
**Status:** Accepted
Accounts may exist without a known platform identifier (`platform_id` nullable) until identified.

### R5 — Duplicate handling
**Status:** Accepted
Unique `(platform, platform_id)` when known; a new-account event attaches to the existing account. Provisional accounts may duplicate; an admin merge action re-points events to the canonical account and retires the duplicate. Fuzzy auto-detection is deferred.

### R6 — War Thunder membership derivation
**Status:** Accepted
A member's War Thunder membership is derived from any active War Thunder account link with an active squadron membership event; conflicts across accounts are flagged and the most recent event wins.

### R7 — No presence tracking
**Status:** Accepted
Discord presence/activity is not tracked. Members being required on the Discord server is context only.

### R8 — Discord and Steam membership
**Status:** Accepted
Group joins/leaves are events. Discord handle/ID and Steam name/steamID64 history are tracked. No presence or activity tracking.

### S — Sections
**Status:** Accepted
Sections are Multigaming (core), War Thunder, and Arma 3. Section membership is derived from membership events (squadron/section events); no separate stored section-membership state.

---

## 4. Membership, Ranks & Statuses (M)

### M1 — Lifecycle events
**Status:** Accepted
Membership lifecycle events are join, leave, and kick. A rejoin is simply another join event (there is no distinct rejoin event).

### M2 — Leave/kick effects
**Status:** Accepted
Leave/kick implicitly ends core derived state (core rank, veteran, core statuses) and marks section memberships inactive until a later join; section-specific events remain independent.
**Alternatives:** require an explicit end event per section/status (rejected — redundant with the leave/kick event).

### M3 — Rejoin and awards
**Status:** Accepted
Rejoining starts from scratch (nothing is restored). Awards persist across leave and return, and may be granted to non-members.

### M4 — Veteran
**Status:** Accepted
Veteran is a special status, only possible for clan members. It ends on leave/kick and must be re-earned after rejoining.

### M5 — Special statuses
**Status:** Accepted
Multiple special statuses may coexist; currently only veteran exists. Suspension is not a special status (see S1).

### M6 — Rank catalog
**Status:** Accepted
A seeded rank catalog (core, War Thunder, Arma 3) with ordering. Promotions and demotions are recorded as events; a demotion is a new event, never an edit.

### M7 — Awards
**Status:** Accepted
Awards may be repeatable, once-only, or tiered (a lower tier is upgraded to a higher tier). Revocation is an event.

### M8 — Arma 3 qualifications
**Status:** Open
Qualification and specialization decisions are postponed to a later stage.

### S1 — Suspension
**Status:** Accepted
Suspension is a section-scoped interval with explicit start and end dates, reason, and source; overlapping suspensions for the same member + section are disallowed.

---

## 5. Prototype & Access (X)

### X1 — Prototype scope
**Status:** Accepted
Phase 1 is a local / controlled prototype; the role selector is a dev-only convenience.

### X2 — Authentication
**Status:** Accepted
Real authentication is a prerequisite before production / internet exposure.

### X3 — Member visibility
**Status:** Accepted
Members view clan-wide data read-only, excluding kick reasons, administrative notes, audit detail, and suppressed source data.

### X4 — Owner vs Administrator
**Status:** Accepted
Owner and Administrator have identical rights for now; a finer split is deferred.

### X5 — Server-side hardening
**Status:** Accepted
Server-side authorization, form validation, and POST protection are non-negotiable in the first implementation.

---

## 6. Database & Operations (D)

### D1 — Keys and defaults
**Status:** Accepted
`SERIAL` / `Generated<number>` primary keys; `source` NOT NULL default `manual`; natural unique keys where stable.

### D2 — Retention
**Status:** Accepted
Soft-delete / retention for historical records; no cascading hard deletes.

### D3 — Transactions
**Status:** Accepted
Multi-table mutations are wrapped in Kysely transactions.

### D4 — Concurrency
**Status:** Accepted
Optimistic locking via `updated_at` on mutable/edit rows.

### D5 — Migrations
**Status:** Accepted
Kysely `Migrator` with timestamped migration files, run via a Bun script.

### D6 — Seed data
**Status:** Accepted
Sections, rank catalog, statuses, and award catalog are seeded via migration/script.

### D7 — Backups
**Status:** Accepted
PostgreSQL `pg_dump`; restore steps are documented under operations.

### D8 — Bot boundary
**Status:** Accepted
The future bot writes only `source: auto`, never overwrites manual data, and deduplicates via natural keys / idempotency keys.

---

## 7. Phasing & Versions (P)

### P1 — Phase 1 order and acceptance criteria
**Status:** Accepted
Adopt the following implementation order, with acceptance criteria added before each step:

1. Runnable skeleton, configuration, typecheck, migrations.
2. Member, membership cycle, nickname history.
3. Platform accounts and linkage history.
4. Sections, ranks, statuses, awards.
5. Arma 3 history and convenient data entry.
6. Permission and historical-scenario verification.

Key scenarios to verify: rejoin, unknown date, backdated entry, borrowed account, bad-link correction, source conflict.

### P2 — Versions
**Status:** Accepted
Bun `>= 1.4`; PostgreSQL 18.

---

## Open Items

- **R2** — whether `is_owner` is needed and the final account relation-type set.
- **M8** — Arma 3 qualifications/specializations (deferred).
- **Award catalog** — the concrete list of awards and their requirements (data, not structure).
- **Later phases** — statistics, operations, and Discord automation details.
