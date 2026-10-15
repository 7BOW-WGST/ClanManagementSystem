# Clan Management System — Domain & Architecture Decisions

This log records the domain-model and architecture decisions for the project. It accompanies [`REQUIREMENTS.md`](./REQUIREMENTS.md) (product scope) and [`AGENTS.md`](../../AGENTS.md) (coding standards). Detailed catalog contents live in [`CATALOGS.md`](./CATALOGS.md); the schema dictionary lives in [`DATA_MODEL.md`](./DATA_MODEL.md); testable outcomes live in [`ACCEPTANCE.md`](./ACCEPTANCE.md). Where this document is more specific, it takes precedence at implementation time; product scope remains in `REQUIREMENTS.md`.

**Status values:** `Accepted` (agreed, ready to implement), `Open` (undecided), `Superseded` (replaced by a later decision).

The current state of everything is **derived from an append-only event log**; the only explicitly time-bounded record is a section suspension (S1). Supported runtime versions: **Bun >= 1.4**, **PostgreSQL 18** (P2).

---

## 1. History Model (H)

### H1 — Event-sourced history
**Status:** Accepted
All changes are recorded as append-only events, each with a single `event_date`; current state is derived.
**Event kinds:** join / leave / kick; nickname change; promotion / demotion; award grant / revoke / upgrade; veteran gained / lost; account created / relation changed / removed; squadron membership; section membership; Discord group membership; Steam group membership.
**Alternatives:** per-attribute time-bounded interval rows (rejected — ambiguous "no end date" semantics and complex in-place updates).

### H2 — Interval end bounds
**Status:** Superseded — by H1/S1. Interval bounds apply only to suspensions.

### H3 — Open vs unknown end date
**Status:** Superseded — by H1. Derived end dates come from the next event in the stream; no stored end date outside suspensions.

### H4 — Overlaps
**Status:** Accepted
Overlap constraints apply only to suspensions; overlapping suspensions for the same member + section are disallowed.
**Rationale:** every other attribute derives its end from the next event, so overlaps cannot occur by construction.

### H5 — Same-day ordering
**Status:** Accepted
Multiple events on the same date are ordered by insertion (`recorded_at`, then `id`); the later one wins.

### H6 — Backdating
**Status:** Accepted
Events store `event_date` (real-world) separately from `recorded_at` (system). A backdated event is inserted as-is; derived state recomputes on read. Ordering is validated and contradictions are flagged for admin review, not blocked.
**Rationale:** with event sourcing, backdating is a pure insert; nothing needs rewriting.

### H7 — Revision and priority variants
**Status:** Accepted
- **V1** auto → add manual: manual wins, automated value retained.
- **V2** manual → edit manual: newest wins, old value discarded (a correction).
- **V3** manual → add manual: newest wins, old value retained (new information).
- **V4** auto → auto append: newest automated value is appended and retained.
- **V5** manual → withdraw: override removed, retained automated value becomes effective again.
- Date-only and value fixes are treated as **V2 corrections**; no history is preserved for clerical-error fixes.
**Alternatives:** fully immutable audit of every edit (rejected — overkill for clerical fixes).

### H8 — Validity vs recorded dates
**Status:** Accepted
Every event keeps `event_date` (real-world) and `recorded_at` (system), plus `source`.

### H9 — Partial and unknown dates
**Status:** Accepted
`event_date` is stored with an `event_date_precision` of `day` | `month` | `year` | `unknown`; a day is never fabricated (e.g. unknown days are not coerced to the first of the month). An event with `unknown` precision is displayed as undated and is **excluded from determining current state**, so an undated old entry can never look current. Events with a `future` event date are rejected. `event_date` is a calendar date (no timezone); `recorded_at` is stored in **UTC**. An "as-of date" view is deferred.

### H10 — Per-domain event tables
**Status:** Accepted
Events are stored in typed per-domain tables (member lifecycle, nickname, promotion, veteran, account, link, squadron, section, Discord, Steam, awards).
**Rationale:** strong Kysely typing, explicit and flat; avoids JSON payloads.

### H11 — Derive on read
**Status:** Accepted
Current state is computed from events on read; no materialized snapshots in Phase 1.
**Alternatives:** materialized current-state tables (deferred — may revisit if performance requires).

---

## 2. Current-State Resolution (CS)

### CS1 — Deterministic precedence
**Status:** Accepted
For any derived value, the effective record is chosen in this order:
1. Exclude soft-deleted / withdrawn records.
2. Latest `event_date` wins.
3. On the same date, `manual` outranks `auto`.
4. Still tied: later `recorded_at`, then `id`.
**Consequence:** an older manual entry (e.g. a backfilled 2020 nickname) does **not** become current over newer reality (a 2025 nickname); manual only wins at equal recency. `A2` is read accordingly.

### CS2 — Timestamp naming
**Status:** Accepted
Insert time is `recorded_at` everywhere; edits use `updated_at`. The earlier `created_at` naming is dropped.

---

## 3. Mutation & Data Operations (MO)

### MO1 — Mutation taxonomy
**Status:** Accepted
Exactly five mutation operations are allowed, each with defined persistence:
- **Create event** — append; prior records remain.
- **Correct value** — in-place update, no history (clerical fixes only).
- **Withdraw override** — remove/disable the manual value; the retained automated value resurfaces.
- **Soft-delete entry** — set `deleted_at` + reason; retained for audit, excluded from derivation.
- **Merge accounts** — re-point events to the canonical account, write a merge-audit row, soft-delete the duplicate.

### MO2 — Append-only scope
**Status:** Accepted
"Append-only" applies to reality events. MO1's correct/withdraw/soft-delete/merge are the only bounded exceptions. D2 retention covers reality records and soft-deletes, not clerical corrections.

---

## 4. Event Streams (ES)

### ES1 — Stream definition
**Status:** Accepted
History is tracked per stream, each with its own closing rule:
member lifecycle (join/leave/kick); member nickname; core rank; Arma 3 rank; veteran; account identity; account ↔ member link; War Thunder squadron/section membership; Arma 3 section membership; award instance; suspension; Discord group; Steam group.

### ES2 — Closing rule
**Status:** Accepted
"End = next event in the same stream" applies **per stream only**. Repeatable awards are **per-instance streams**: a re-grant does not close a prior grant; a revocation closes a specific instance.

---

## 5. Change Auditing & Priority (A)

### A1 — Override granularity
**Status:** Accepted — manual overrides apply at the field / derived-value level, not to whole entities.

### A2 — Manual priority
**Status:** Accepted — manual values beat automated values until explicitly withdrawn (no expiry); see CS1 for the recency rule.

### A3 — Withdrawal
**Status:** Accepted — withdrawing an override reverts to the retained automated value (V5).

### A4 — Conflicting manual values
**Status:** Accepted — latest `recorded_at` wins; both entries are retained (V3).

### A5 — Dashboard transparency
**Status:** Accepted — the dashboard shows the effective value plus a "lower-priority source suppressed" indicator with a drill-down to suppressed data.

### A6 — Audit fields
**Status:** Accepted
Records carry `source`, `created_by`, `recorded_at`, and (where applicable) `reason`; there is **no `supersedes_id`** (precedence in CS1 resolves versions). During the prototype, manual edits are attributed to the Owner.

### A7 — Automated updates
**Status:** Accepted — newer automated values are appended and retained (V4); the effective value is the newest automated value unless a manual override exists.

### A8 — Grant reasons
**Status:** Accepted — a reason is required per grant for three categories only: **Krzyże Zasługi**, **Za wkład w sekcję Army**, and **Za bitwy dywizjonowe**.

---

## 6. Members, Accounts & Sections (R)

### R1 — Relation is a link property
**Status:** Accepted
`main` / `alt` / `borrowed` describes the member → **War Thunder** account link, not the account itself. These relation types apply to War Thunder accounts only.

### R2 — Relation type set
**Status:** Accepted
The final set is `main | alt | borrowed`; ownership is implied by `main`/`alt`, so a separate `is_owner` flag is **not** used. (Closes the earlier open item.)

### R3 — Relation constraints
**Status:** Accepted
A War Thunder account may have any number of `borrowed` links and at most one `main` / `alt` designation; `main` and `alt` are mutually exclusive. Additionally, a member may hold at most **one `main`** account (many `alt`, many `borrowed`).
**Valid:** main of A + borrowed by B, C; alt of A + borrowed by B.
**Invalid:** main of A + alt of B; two `main` accounts for A.

### R4 — Provisional accounts
**Status:** Accepted — accounts may exist without a known platform identifier (`platform_id` nullable) until identified.

### R5 — Duplicate handling
**Status:** Accepted — unique `(platform, platform_id)` when known; a new-account event attaches to the existing account. Provisional accounts may duplicate; an admin merge re-points events and retires the duplicate. Fuzzy auto-detection is deferred.

### R6 — War Thunder membership derivation
**Status:** Accepted
A member's War Thunder membership derives from any active War Thunder account link with an active squadron membership event. Only `main`/`alt` links contribute — `borrowed` grants no membership. A member holds **one active squadron** at a time; if accounts disagree, the conflict is flagged and the most recent squadron event wins.

### R7 — No presence tracking
**Status:** Accepted — Discord presence/activity is not tracked; members being on Discord is context only.

### R8 — Discord and Steam membership
**Status:** Accepted — group joins/leaves are events; Discord handle/ID and Steam name/steamID64 history are tracked.

### R9 — Sharing scope
**Status:** Accepted — sharing/`borrowed` is War Thunder-only; Discord, Steam, and Arma3Units accounts each belong to exactly one member.

### R10 — Stable identifier vs name
**Status:** Accepted — each account stores a stable, normalized `platform_id` (null when unknown) separately from its changeable display name.

### S — Sections
**Status:** Accepted — Sections are Multigaming (core), War Thunder, and Arma 3. Section membership derives from membership events; leaving/being kicked **closes** section memberships (see M2) and rejoining requires a fresh section/squadron event.

---

## 7. Membership, Ranks & Statuses (M)

### M1 — Lifecycle events
**Status:** Accepted — lifecycle events are join, leave, and kick. A rejoin is simply another join event.

### M2 — Leave/kick effects
**Status:** Accepted
Leave/kick ends core derived state (core rank, veteran, core statuses) **and forces section memberships closed**. Rejoining requires a fresh section/squadron event; nothing is restored automatically.

### M3 — Rejoin and identity
**Status:** Accepted
Rejoining starts privileges from scratch. **Identity persists** (community nickname history and awards), and awards are never lost on leave. Non-member award recipients are modeled as **members** (the identity root), so awards always reference a member row.

### M4 — Veteran
**Status:** Accepted — veteran is a special status, only possible for clan members; it ends on leave/kick and must be re-earned after rejoining.

### M5 — Special statuses
**Status:** Accepted — multiple special statuses may coexist; currently **only veteran** exists. Suspension is not a special status (see S1).

### M6 — Rank catalog and streams
**Status:** Accepted
One shared rank catalog (attributes and ordering in [`CATALOGS.md`](./CATALOGS.md)). Core and Arma 3 sections use the same rank definitions but run **independent, unrelated promotion streams**. War Thunder has no separate rank catalog. Promotions/demotions are events; a demotion is a new event, never an edit.

### M7 — Awards
**Status:** Accepted
Awards are tied to the core member identity and have no section association. Awards may be separate/once-only or tiered, with a per-member limit (`max_per_member`: unlimited or 1). Tiered awards upgrade (the lower degree is dropped). Revocation is an event and is re-grantable. Definitions in [`CATALOGS.md`](./CATALOGS.md).

### M8 — Arma 3 qualifications
**Status:** Open — qualification/specialization decisions are postponed to a later stage.

### S1 — Suspension
**Status:** Accepted
Suspension is a section-scoped interval with a start date, a **nullable end date** (null = ongoing/indefinite), reason, and source. Overlapping suspensions for the same member + section are disallowed, enforced by a DB constraint + transaction.

---

## 8. Catalogs (C)

### C1 — Rank catalog
**Status:** Accepted — one shared, seeded catalog (`name`, `corps`, `order`, `is_appointed`); no icons. Rules: officer ranks are appointed by the Pułkownik and not activity-driven; warrant ranks are non-linear; Elew must advance within 2 months (warning). Full list in [`CATALOGS.md`](./CATALOGS.md).

### C2 — Award catalog
**Status:** Accepted — one flat, seeded catalog (`name`, `category`, `tier_group`, `tier_level`, `requirement`, `max_per_member`, `requires_reason`). Categories and per-award limits/tiers/reason flags are in [`CATALOGS.md`](./CATALOGS.md); catalog changes are manual in Phase 1.

---

## 9. Prototype & Access (X)

### X1 — Prototype scope
**Status:** Accepted — Phase 1 is a local/controlled prototype. The role selector is **dev-only**: gated by an environment flag and stored server-side; it is unavailable in production.

### X2 — Authentication
**Status:** Accepted — real authentication is a prerequisite before production / internet exposure.

### X3 — Member visibility
**Status:** Accepted — members view clan-wide data read-only, excluding kick reasons, administrative notes, audit detail, and suppressed source data. Exclusions are enforced **in server responses**, not merely hidden in the UI.

### X4 — Owner vs Administrator
**Status:** Accepted — identical rights for now; a finer split is deferred.

### X5 — Server-side hardening
**Status:** Accepted — server-side authorization (re-checked per module), form validation, and same-site/CSRF POST protection are non-negotiable.

### X6 — Listen address
**Status:** Accepted — the local prototype binds an explicit address (`127.0.0.1:3000`).

---

## 10. Database, Operations & Concurrency (D)

### D1 — Keys and defaults
**Status:** Accepted — `SERIAL` / `Generated<number>` primary keys; `source` NOT NULL default `manual`; natural unique keys where stable.

### D2 — Retention
**Status:** Accepted — soft-delete / retention for historical records; no cascading hard deletes.

### D3 — Transactions
**Status:** Accepted — multi-table mutations are wrapped in Kysely transactions.

### D4 — Optimistic locking
**Status:** Accepted — mutable/edit rows carry `updated_at`.

### D5 — Migrations
**Status:** Accepted — Kysely `Migrator` with timestamped migration files, run via a Bun script.

### D6 — Seed data
**Status:** Accepted — sections, rank catalog, and award catalog are seeded via migration/script.

### D7 — Backups
**Status:** Accepted — PostgreSQL `pg_dump`; restore steps are documented in the repo.

### D8 — Bot boundary
**Status:** Accepted — the future bot writes only `source: auto`, never overwrites manual data, and deduplicates via natural keys / idempotency keys.

### D9 — Concurrency enforcement
**Status:** Accepted
`updated_at` alone cannot enforce set-level rules. The following are enforced inside transactions (with DB constraints/indexes where possible): one active `main`/`alt` per account, one `main` per member, award per-member limits, and no overlapping suspensions. Form-level validation is not sufficient.

---

## 11. Configuration & CI (E)

### E1 — Startup configuration
**Status:** Accepted — validate `DATABASE_URL` at startup (fail fast); host/port from environment; handle DB errors; close the connection pool on exit.

### E2 — Migration & seed scripts
**Status:** Accepted — running migrations and seeding are repeatable and idempotent from a clean database.

### E3 — CI
**Status:** Accepted — CI installs with `bun install --frozen-lockfile` and runs on **both Ubuntu and Windows**, matching the Windows deployment target.

---

## 12. Phasing & Versions (P)

### P1 — Phase 1 order and acceptance criteria
**Status:** Accepted
Implementation order:
1. Runnable skeleton, configuration, typecheck, migrations.
2. Member, membership cycle, nickname history.
3. Platform accounts and linkage history.
4. Sections, ranks, statuses, awards.
5. Arma 3 history and convenient data entry.
6. Permission and historical-scenario verification.

Acceptance criteria and scenario outcomes are in [`ACCEPTANCE.md`](./ACCEPTANCE.md).

### P2 — Versions
**Status:** Accepted — Bun `>= 1.4`; PostgreSQL 18.

---

## Open Items

- **M8** — Arma 3 qualifications/specializations (deferred).
- **Later phases** — statistics, operations, and Discord automation details.
