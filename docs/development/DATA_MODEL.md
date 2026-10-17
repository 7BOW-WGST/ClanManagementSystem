# Clan Management System — Data Model

This is the design dictionary for the database. It is the reference for the Kysely interfaces in [`src/db/types.ts`](../../src/db/types.ts) and the source for the migrations in `src/db/migrations/`. Rationale for each rule lives in [`DECISIONS.md`](./DECISIONS.md); catalog contents live in [`CATALOGS.md`](./CATALOGS.md).

## Conventions

- `snake_case` tables/columns; `SERIAL` / `Generated<number>` primary keys.
- **Event tables** share a common column set: `id`, the stream-owner FK, `event_date` (`DATE`, nullable), `event_date_precision` (`day` | `month` | `year` | `unknown`), `recorded_at` (insert time, UTC), `source` (`manual` | `auto`, default `manual`), `created_by` (prototype value `owner`), `reason` (nullable), and `deleted_at` (nullable soft delete).
- **Catalog / mutable rows** carry `id`, `recorded_at`, `source`, `updated_at`, and (where deletable) `deleted_at`.
- **External identifiers are stored as text** (Discord snowflake, steamID64, etc. exceed the safe range of a JS `number`).
- Calendar dates and `recorded_at` are mapped per `DECISIONS.md` H9 (event_date calendar date; recorded_at UTC).

---

## 1. Identity & accounts

### `members`

The **identity root**. Every person the system knows about is a member row, including people who currently hold no clan membership (e.g. non-member award recipients).

- `id` PK, `recorded_at`, `source`, `updated_at`, `deleted_at`

### `accounts`

A distinct external platform account, separate from the member.

- `id` PK
- `platform` — `discord` | `warthunder` | `arma3units` | `steam`
- `platform_id` (text, nullable) — stable normalized identifier (Discord snowflake, steamID64, Arma3Units id, WT id where known). Null means the identifier is **unknown/provisional**; it does **not** mean the account is unassigned (assignment is tracked by link events).
- `created_event_date` (nullable) + `created_event_date_precision` — when the account first appeared, if known
- constraints: `UNIQUE (platform, platform_id)` where `platform_id IS NOT NULL`
- `recorded_at`, `source`, `updated_at`, `deleted_at`

### `account_link_events`

Unified member ↔ account link history, for **all four platforms** (R11).

- `id` PK, `account_id` FK → `accounts`, `member_id` FK → `members`
- `action` — `link` | `unlink` | `relation_change`
- `relation` — `main` | `alt` | `borrowed` (War Thunder only; null otherwise)
- `event_date`, `event_date_precision`, `recorded_at`, `source`, `created_by`, `reason`, `deleted_at`
- stream key: `(account_id, member_id)` (allows multiple parallel `borrowed` links)
- enforcement (transactional): at most one active `main`/`alt` per account; `main` and `alt` mutually exclusive; at most one active `main` per member; `relation` only for War Thunder; non-WT accounts have at most one active member.

### `account_name_events`

An account's display/nickname history.

- `id` PK, `account_id` FK, `name`, `event_date`, `event_date_precision`, `recorded_at`, `source`, `created_by`, `reason`, `deleted_at`

### `account_merge_audit`

Record of account merges (see MO1).

- `id` PK, `canonical_account_id` FK → `accounts`, `merged_account_id` FK → `accounts`, `reason`, `recorded_at`, `created_by`, `source`

---

## 2. Membership & identity history

### `member_lifecycle_events`

- `id` PK, `member_id` FK, `type` (`join` | `leave` | `kick`), `event_date`, `event_date_precision`, `reason` (nullable), `recorded_at`, `source`, `created_by`, `deleted_at`

### `member_nickname_events`

Community nickname history.

- `id` PK, `member_id` FK, `nickname`, `event_date`, `event_date_precision`, `recorded_at`, `source`, `created_by`, `reason`, `deleted_at`

### `veteran_events`

- `id` PK, `member_id` FK, `type` (`granted` | `removed`), `event_date`, `event_date_precision`, `recorded_at`, `source`, `created_by`, `deleted_at`

---

## 3. Ranks

### `ranks` (catalog)

- `id` PK, `name`, `corps` (`enlisted` | `nco` | `warrant` | `officer`), `order`, `introduced_at` (year precision)
- officer-ness derives from `corps = officer`; promotions may skip ranks (no adjacency requirement); the catalog is append-only

### `core_promotion_events`

- `id` PK, `member_id` FK, `rank_id` FK → `ranks`, `event_date`, `event_date_precision`, `recorded_at`, `source`, `created_by`, `reason`, `deleted_at`

### `arma3_promotion_events`

Independent Arma 3 rank stream; same catalog.

- `id` PK, `member_id` FK, `rank_id` FK → `ranks`, `event_date`, `event_date_precision`, `recorded_at`, `source`, `created_by`, `reason`, `deleted_at`

---

## 4. Sections & platform membership

### `sections` (catalog)

- `id` PK, `name` (`multigaming` | `warthunder` | `arma3`)

### `squadron_membership_events` (War Thunder)

- `id` PK, `account_id` FK, `squadron` (`7BOW` | `7BOWs` | `7BOWr`), `type` (`join` | `leave`), `event_date`, `event_date_precision`, `recorded_at`, `source`, `created_by`, `deleted_at`

### `arma3_section_events`

- `id` PK, `member_id` FK, `type` (`join` | `leave`), `event_date`, `event_date_precision`, `recorded_at`, `source`, `created_by`, `deleted_at`

### `discord_group_events`

- `id` PK, `account_id` FK, `type` (`join` | `leave`), `event_date`, `event_date_precision`, `recorded_at`, `source`, `created_by`, `deleted_at`

### `steam_group_events`

- `id` PK, `account_id` FK, `type` (`join` | `leave`), `event_date`, `event_date_precision`, `recorded_at`, `source`, `created_by`, `deleted_at`

### `suspensions`

The only time-bounded (start + end) record. Section-scoped.

- `id` PK, `member_id` FK, `section_id` FK → `sections`, `start_date` + `start_date_precision`, `end_date` (nullable = ongoing) + `end_date_precision`, `reason`, `recorded_at`, `source`, `created_by`, `updated_at`, `deleted_at`
- enforcement: no overlapping suspensions per `(member_id, section_id)`

---

## 5. Awards

Awards are tied to the core member identity and have **no section association**.

### `awards` (catalog)

- `id` PK, `name`, `category`, `tier_group` (nullable), `tier_level` (nullable), `requirement`, `max_per_member` (nullable int; NULL = unlimited), `requires_reason` (bool), `introduced_at` (year precision)
- definitions in [`CATALOGS.md`](./CATALOGS.md)

### `award_events`

Each `grant` row **is** an award instance; `revoke`/`upgrade` target a specific grant.

- `id` PK, `member_id` FK → `members`, `award_id` FK → `awards`
- `type` — `grant` | `revoke` | `upgrade`
- `target_event_id` (nullable, self-FK → `award_events`) — for `revoke`, the revoked grant; for `upgrade`, the replaced (lower) grant
- `event_date`, `event_date_precision`, `reason` (nullable; required per award when `requires_reason`), `recorded_at`, `source`, `created_by`, `deleted_at`
- derived: a grant is active if no later `revoke` targets it
- enforcement (transactional): respect `max_per_member` per `(member_id, award_id)` and per tier-group (max one); tiered upgrades close the lower grant.

---

## 6. Actors

### `actors` (deferred)

Actor/author identity for audit. During the Phase 1 prototype, `created_by` is the concrete value `owner`; a real actor model arrives with authentication.

---

## 7. Cross-cutting rules

- Current state is **derived on read** from event tables (no materialized snapshots in Phase 1).
- Uniqueness and exclusivity constraints that cannot be expressed as simple DB constraints (active relation, award limits, suspension overlap) are enforced inside transactions; partial unique/exclusion indexes are used where a current-state column exists.
- Soft delete (`deleted_at`) + retention; no cascading hard deletes.

### Blocking vs warning (D10)

- **Blocking (rejected):** missing required fields; invalid precision; a `future` `event_date`; a duplicate `(platform, platform_id)` when creating a new account; any violation of the **current** state's constraints.
- **Warning (accepted + surfaced in a conflict view):** a backfill, correction, or merge that would violate a constraint only in the **past**; e.g. two historical `main` links, a contradictory join/leave cycle.
- Validation evaluates the projection at the edited event's `event_date`.
