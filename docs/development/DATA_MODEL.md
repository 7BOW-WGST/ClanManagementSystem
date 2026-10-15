# Clan Management System — Data Model

This is the design dictionary for the database. It is the reference for the Kysely interfaces in [`src/db.ts`](../../src/db.ts) and the source for migrations. Rationale for each rule lives in [`DECISIONS.md`](./DECISIONS.md); catalog contents live in [`CATALOGS.md`](./CATALOGS.md).

Conventions: `snake_case` tables/columns; `SERIAL` / `Generated<number>` primary keys; every table has `recorded_at` (insert time, UTC) and `source` (`manual` | `auto`, default `manual`); mutable rows also carry `updated_at`; deletable rows carry `deleted_at` (soft delete).

---

## 1. Identity & accounts

### `members`

The **identity root**. Every person the system knows about is a member row, including people who currently hold no clan membership (e.g. non-member award recipients).

- `id` PK
- `recorded_at`, `source`, `updated_at`

### `accounts`

A distinct external platform account, separate from the member.

- `id` PK
- `platform` — `discord` | `warthunder` | `arma3units` | `steam`
- `platform_id` (nullable) — stable identifier, normalized (Discord snowflake, steamID64, Arma3Units id, WT id where known). Null = provisional/unlinked.
- `created_event_date` (nullable) — when the account first appeared, if known
- constraints: `UNIQUE (platform, platform_id)` where `platform_id IS NOT NULL`
- `recorded_at`, `source`, `updated_at`, `deleted_at`

### `account_link_events`

Member ↔ account relation changes. **War Thunder accounts only.**

- `id` PK
- `account_id` FK → `accounts`
- `member_id` FK → `members`
- `relation` — `main` | `alt` | `borrowed`
- `event_date`, `event_date_precision`
- `recorded_at`, `source`, `updated_at`
- enforcement (transactional): at most one active `main`/`alt` per account; `main` and `alt` mutually exclusive; at most one active `main` per member; `borrowed` may be many.

### `account_name_events`

An account's display/nickname history.

- `id` PK, `account_id` FK, `name`, `event_date`, `event_date_precision`, `recorded_at`, `source`

---

## 2. Membership & identity history

### `member_lifecycle_events`

- `id` PK, `member_id` FK, `type` (`join` | `leave` | `kick`), `event_date`, `event_date_precision`, `reason` (nullable), `recorded_at`, `source`

### `member_nickname_events`

Community nickname history.

- `id` PK, `member_id` FK, `nickname`, `event_date`, `event_date_precision`, `recorded_at`, `source`

### `veteran_events`

- `id` PK, `member_id` FK, `type` (`granted` | `removed`), `event_date`, `event_date_precision`, `recorded_at`, `source`

---

## 3. Ranks

### `ranks` (catalog)

- `id` PK, `name`, `corps` (`enlisted` | `nco` | `warrant` | `officer`), `order`, `introduced_at` (nullable)
- officer-ness derives from `corps = officer`; promotions may skip ranks (no adjacency requirement); the catalog is append-only

### `core_promotion_events`

- `id` PK, `member_id` FK, `rank_id` FK → `ranks`, `event_date`, `event_date_precision`, `recorded_at`, `source`

### `arma3_promotion_events`

Independent Arma 3 rank stream; same catalog.

- `id` PK, `member_id` FK, `rank_id` FK → `ranks`, `event_date`, `event_date_precision`, `recorded_at`, `source`

---

## 4. Sections & platform membership

### `sections` (catalog)

- `id` PK, `name` (`multigaming` | `warthunder` | `arma3`)

### `squadron_membership_events` (War Thunder)

- `id` PK, `account_id` FK, `squadron` (`7BOW` | `7BOWs` | `7BOWr`), `type` (`join` | `leave`), `event_date`, `event_date_precision`, `recorded_at`, `source`

### `arma3_section_events`

- `id` PK, `member_id` FK, `type` (`join` | `leave`), `event_date`, `event_date_precision`, `recorded_at`, `source`

### `discord_group_events`

- `id` PK, `account_id` FK, `type` (`join` | `leave`), `event_date`, `event_date_precision`, `recorded_at`, `source`

### `steam_group_events`

- `id` PK, `account_id` FK, `type` (`join` | `leave`), `event_date`, `event_date_precision`, `recorded_at`, `source`

### `suspensions`

The only time-bounded (start + end) record. Section-scoped.

- `id` PK, `member_id` FK, `section_id` FK → `sections`, `start_date`, `end_date` (nullable = ongoing), `reason`, `recorded_at`, `source`, `updated_at`

- enforcement: no overlapping `[start, COALESCE(end, infinity))` per `(member_id, section_id)`

---

## 5. Awards

Awards are tied to the core member identity and have **no section association**.

### `awards` (catalog)

- `id` PK, `name`, `category`, `tier_group` (nullable), `tier_level` (nullable), `requirement`, `max_per_member` (nullable int; NULL = unlimited), `requires_reason` (bool), `introduced_at` (nullable)
- definitions in [`CATALOGS.md`](./CATALOGS.md)

### `award_events`

Grant / revoke / upgrade of an award instance.

- `id` PK, `member_id` FK → `members`, `award_id` FK → `awards`, `type` (`grant` | `revoke` | `upgrade`), `event_date`, `event_date_precision`, `reason` (nullable; required per award when `requires_reason`), `recorded_at`, `source`
- enforcement (transactional): respect `max_per_member` per `(member_id, award_id)`; tiered upgrades close the lower degree.

---

## 6. Actors

### `actors` (deferred)

Actor/author identity for audit. During the Phase 1 prototype, manual edits are attributed to the Owner placeholder; a real actor model arrives with authentication.

---

## 7. Cross-cutting rules

- Current state is **derived on read** from event tables (no materialized snapshots in Phase 1).
- Event tables carry `event_date` + `event_date_precision` (`day` | `month` | `year` | `unknown`) and `recorded_at` (UTC).
- Uniqueness and exclusivity constraints that cannot be expressed as simple DB constraints (active relation, award limits, suspension overlap) are enforced inside transactions; partial unique/exclusion indexes are used where a current-state column exists.
- Soft delete (`deleted_at`) + retention; no cascading hard deletes.
