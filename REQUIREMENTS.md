# Clan Management System — Requirements

A management system for a gaming clan, tracking members, their history and status, and the clan's structures, through a web dashboard. The clan is active in War Thunder and Arma 3, with a base "Multigaming" membership.

This document covers product requirements and environment constraints only. The technical stack is deliberately out of scope.

## 1. Users & Access

- Roles: **Owner**, **Administrator**, **Member**.
- **Owner/Administrator** — manage and edit all data.
- **Member** — logs in and views clan-wide data, read-only.
- **Login (now):** a placeholder "login" panel that is only a role selector (Owner / Admin / Member). No real credentials.
- **Login (later):** real authentication is planned for a later phase.

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
  - A member may have **multiple accounts per platform** (e.g. main, alt, shared).
  - Accounts may exist **unlinked** until a member is identified.
  - Member–account links are **time-bounded** (recorded with start and end dates where applicable).
- **Accounts vs member** — an account's nickname history belongs to the **account**; the member has a separate community **nickname history**.
- **Sections** — Multigaming (base, every member), War Thunder, Arma 3.
  - War Thunder membership is tracked via **squadron membership events** (7BOW / 7BOWs / 7BOWr).
  - Arma 3 membership is tracked via section membership and Arma3Units profile links.
- **Platforms tracked:** Discord, War Thunder accounts, Arma3Units, Steam.

## 4. Phase 1 Detailed Scope (Core & Platforms)

### 4.1 Core Clan Member Identity

- **Membership lifecycle:** join, rejoin, leave, kicked/removed, veteran status.
- **Nickname history:** member's community nickname over time.
- **Ranks & Promotions:** core rank, rank history, and promotion dates.
- **Orders/decorations:** pool of awards and member award history.
- **Special statuses:** veteran, leave of absence, etc.

### 4.2 Platform Accounts & Sections

- **Discord:** Discord ID/account association, handle/username history, and mandatory presence tracking.
- **War Thunder Section:**
  - Section membership status.
  - Game account names and previous nickname history.
  - Squadron membership events (7BOW, 7BOWs, 7BOWr).
  - Account access type (own, main, alt, shared).
- **Arma 3 Section:**
  - Section membership status.
  - Arma3Units account link/name.
  - Section-specific ranks and promotions (separate from core ranks).
  - Specializations, instructor qualifications, active/inactive status, and basic training status.
- **Steam Platform:**
  - Account name, steamID64.
  - Steam Group membership status events.

## 5. History & Data Principles

- **Event-based:** changes are recorded as events or time-bounded state records; current state is derived from them.
- **Unknown/partial dates are allowed**; a missing date represents unknown historical data.
- **Time-bounded validity:** record the start and end dates of states and relationships where known.
- **Manual vs automated:** manual entries/corrections rank highest. Automated data ranks below them. Both are stored and **marked as manual or automated** (`source: manual` vs `auto`), remaining accessible for audit/troubleshooting. The dashboard displays data according to this hierarchy of importance (manual wins).

## 6. Data Entry

- **Phase 1:** Manual entry by Owner/Administrators via the web dashboard to backfill and manage historical and current data.
- **Later Phases:** Automated data arrives via the separate Discord bot and platform APIs/scrapers. Manual data takes precedence over automated data (§5).

## 7. Open Questions

- Order catalog: the fixed list of orders/decorations and their requirements.
- Special statuses: the complete list and their behavior.
- Do awards/decorations persist across a member leaving and rejoining?
- Activity/statistics and operations details (deferred to later phases).

## 8. Out of Scope

- TeamSpeak (not tracked).
- Public-facing site (clan users only).
- Mobile app.
- In-system chat/messaging.

## 9. Environment Constraints

- Runs on a **physical Windows server shared with other workloads**; resource use should stay modest.
