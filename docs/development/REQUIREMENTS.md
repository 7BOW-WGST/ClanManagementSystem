# Clan Management System — Requirements

A management system for a gaming clan, tracking members, their history and status, and the clan's structures, through a web dashboard. The clan is active in War Thunder and Arma 3, with a base "Multigaming" membership.

This document covers product requirements and environment constraints only. The technical stack is deliberately out of scope. Resolved domain-model decisions and their rationale are recorded in [`DECISIONS.md`](./DECISIONS.md).

## 1. Users & Access

- Roles: **Owner**, **Administrator**, **Member**.
- **Owner/Administrator** — manage and edit all data; both currently have identical rights.
- **Member** — logs in and views clan-wide data, read-only. Members do not see kick reasons, administrative notes, audit detail, or suppressed source data.
- **Login (now):** a placeholder "login" panel that is only a role selector (Owner / Admin / Member). No real credentials. Phase 1 is a local prototype and manual edits are treated as made by the Owner.
- **Login (later):** real authentication is planned for a later phase, and is a prerequisite before the system is exposed beyond the local prototype.

## 2. Scope & Phasing

Four phases. Phase 1 defines the manual web dashboard foundation; later phases bring automation and operational depth.

- **Phase 1 — Core Identity & Platform Account Mapping (Manual Dashboard)**
  - Full core member identity (members, nicknames, ranks, orders/awards, lifecycle events).
  - Manual management and mapping of external platform accounts: Discord, War Thunder, Arma 3 (Arma3Units), and Steam.
  - Historical data backfilling capabilities for all core and platform fields.
- **Phase 2 — Automated War Thunder Data & Statistics Integration**
- **Phase 3 — Discord Automation** (delivered as a **separate bot project** that writes into this system's database).
- **Phase 4 — Advanced Arma 3 Module & Event/Operation Management**

The system must eventually:

- record member identity and history;
- manage ranks, orders, and awards;
- track platform accounts and account-member relationships over time;
- track game activity and statistics (later);
- automate administrative tasks (later, via the separate bot);
- support operations/event management (deferred).

## 3. Domain Concepts

- **Member** — a community identity, independent of any platform account.
- **Platform account** — a distinct entity, separate from the member.
  - A member may have **multiple accounts per platform**.
  - Accounts may exist **unlinked** until a member is identified.
  - War Thunder account relations (`main`, `alt`, or `borrowed`) apply to War Thunder accounts only. The relation is a property of the **link**, not the account; changes to it are recorded as events.
  - A War Thunder account may be `main`/`alt` for at most one member at a time and `borrowed` by several members; `main` and `alt` are mutually exclusive.
- **Accounts vs member** — an account's nickname history belongs to the **account**; the member has a separate community **nickname history**.
- **Sections** — Multigaming (base, every member), War Thunder, Arma 3.
  - Section membership is **derived from membership events**, not stored separately.
  - War Thunder membership is tracked via **squadron membership events** (7BOW / 7BOWs / 7BOWr).
  - Arma 3 membership is tracked via section membership events and Arma3Units profile links.
- **Platforms tracked:** Discord, War Thunder accounts, Arma3Units, Steam.

## 4. Phase 1 Detailed Scope (Core & Platforms)

### 4.1 Core Clan Member Identity

- **Membership lifecycle:** join, leave, kick (a rejoin is simply another join). Leave/kick ends core state and closes all section memberships; rejoining requires a fresh section/squadron event.
- **Nickname history:** member's community nickname over time, recorded as change events.
- **Ranks & Promotions:** core rank drawn from a shared rank catalog; promotion and demotion are recorded as events (a demotion is a new event, never an edit). Arma 3 uses the same catalog but an independent rank stream (§4.2). In the core ranks, Starszy Szeregowy Specjalista is an optional, usually-skipped step for long-serving but irregular members.
- **Orders/decorations:** pool of awards and member award history. Awards are always tied to the core member identity (non-member recipients are recorded as members), persist across leave, and may be repeatable, once-only, or tiered (see [`CATALOGS.md`](./CATALOGS.md)).
- **Special statuses:** veteran (members only; ends on leave and must be re-earned). Suspension is a separate section-scoped, time-bounded record.

### 4.2 Platform Accounts & Sections

- **Discord:** Discord ID/account association, handle/username history, and group membership events. No presence or activity tracking.
- **War Thunder Section:**
  - Section membership (derived from squadron membership events).
  - Game account names and previous nickname history.
  - Squadron membership events (7BOW, 7BOWs, 7BOWr).
  - Account relation (main, alt, borrowed).
  - No separate War Thunder rank catalog (War Thunder uses the core ranks).
- **Arma 3 Section:**
  - Section membership (derived from section membership events).
  - Arma3Units account link/name.
  - Ranks use the shared catalog but an independent promotion stream (unrelated to core ranks). Elew here means basic training is unfinished, and the member is auto-promoted to Szeregowy on completion; Starszy Szeregowy Specjalista is a normal rank.
  - Specializations, instructor qualifications, and basic training tracking are deferred to a later stage.
- **Steam Platform:**
  - Account name, steamID64.
  - Steam Group membership events.

## 5. History & Data Principles

- **Event-based:** all changes are recorded as append-only events, each with a single event date; current state is derived from them. The only explicitly time-bounded record is a section suspension (start and end dates).
- **Derived durations:** an event's effective end is the date of the next event of the same kind; no end dates are stored outside suspensions.
- **Unknown/partial dates are allowed** and carry an explicit precision (day/month/year/unknown); a day is never fabricated, and an undated event never becomes the current value.
- **Same-day events** are ordered by insertion order; the latest supersedes.
- **Backdating is allowed:** events keep both the date the change happened and the date it was recorded.
- **Manual vs automated:** manual and automated entries are both historical events; the effective value follows chronology, and `manual` wins only when competing at the same date. Both are stored and **marked as manual or automated** (`source: manual` vs `auto`), remaining accessible for audit/troubleshooting. The dashboard shows the effective value and indicates when a lower-priority same-date source is suppressed.
- **Audit:** records capture the source, author, and timestamp, plus a reason for grants and corrections that require one.

## 6. Data Entry

- **Phase 1:** Manual entry by Owner/Administrators via the web dashboard to backfill and manage historical and current data. During the local prototype, manual edits are treated as made by the Owner.
- **Later Phases:** Automated data arrives via the separate Discord bot and platform APIs/scrapers. The bot writes only `source: auto`, never overwrites manual data, and deduplicates by natural key. Manual data takes precedence over automated data (§5).

## 7. Open Questions

Resolved decisions and their rationale live in [`DECISIONS.md`](./DECISIONS.md); catalog contents live in [`CATALOGS.md`](./CATALOGS.md). Remaining open items:

- Arma 3 qualifications and specializations (deferred).
- Activity/statistics and operations details (deferred to later phases).

## 8. Out of Scope

- TeamSpeak (not tracked).
- Public-facing site (clan users only).
- Mobile app.
- In-system chat/messaging.

## 9. Environment Constraints

- Runs on a **physical Windows server shared with other workloads**; resource use should stay modest.
