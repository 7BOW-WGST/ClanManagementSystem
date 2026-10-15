# Clan Management System — Rank & Award Catalogs

This document defines the seeded catalogs for **ranks** and **awards**. It is derived from the clan's Discord explanations, snapshots of which are kept in [`reference/`](./reference/). It complements [`DATA_MODEL.md`](./DATA_MODEL.md) (schema) and [`DECISIONS.md`](./DECISIONS.md) (rationale).

Two rules underpin everything here:

- **Ranks** are a single shared catalog. The **core** and **Arma 3** sections both use the same rank definitions, but a member's core rank and Arma 3 rank are **independent, unrelated promotion streams**.
- **Awards** have no section association. Every award is tied to the core member identity.

During the Phase 1 prototype all catalog changes are manual (`source: manual`).

---

## Ranks

### Order and corps

Ascending within each corps.

| # | Rank | Corps |
| --- | --- | --- |
| 1 | Elew | Enlisted |
| 2 | Szeregowy | Enlisted |
| 3 | Starszy Szeregowy | Enlisted |
| 4 | Starszy Szeregowy Specjalista | Enlisted |
| 5 | Kapral | NCO |
| 6 | Starszy Kapral | NCO |
| 7 | Plutonowy | NCO |
| 8 | Starszy Plutonowy | NCO |
| 9 | Sierżant | NCO |
| 10 | Starszy Sierżant | NCO |
| 11 | Sierżant Sztabowy | NCO |
| 12 | Starszy Sierżant Sztabowy | NCO |
| 13 | Młodszy Chorąży | Warrant |
| 14 | Chorąży | Warrant |
| 15 | Starszy Chorąży | Warrant |
| 16 | Młodszy Chorąży Sztabowy | Warrant |
| 17 | Chorąży Sztabowy | Warrant |
| 18 | Starszy Chorąży Sztabowy | Warrant |
| 19 | Podchorąży | Officer |
| 20 | Podporucznik | Officer |
| 21 | Porucznik | Officer |
| 22 | Kapitan | Officer |
| 23 | Major | Officer |
| 24 | Podpułkownik | Officer |
| 25 | Pułkownik | Officer |

### Rank attributes

`name`, `corps` (`enlisted` | `nco` | `warrant` | `officer`), `order`, `introduced_at` (nullable).

- Officer-ness is derived from `corps = officer`; there is no separate `is_appointed` flag.
- `introduced_at` records when the rank was added to the catalog (nullable; supplied during seeding). The catalog is **append-only** — ranks have only ever been added, never removed or renamed.
- `order` leaves gaps so future ranks can be inserted without renumbering.

### Rank streams

- **Core rank** — per member.
- **Arma 3 rank** — per member, using the same catalog but an independent stream, unrelated to the core rank.
- War Thunder has no separate rank catalog.
- Rank **behavior is stream-specific** (below); the catalog holds shared definitions only.

### Behavior rules

Shared:

- Promotions are granted primarily for **activity** (in-game, Discord, squadron battles, events), and secondarily for skill and behavior.
- Promotions may **skip ranks**; advancing to the adjacent rank is not required.
- Promotions and demotions are recorded as events; a demotion is a new event, never an edit of a prior promotion.
- Ranks have no icons stored in this system.

Core stream:

- **Officer corps** (`corps = officer`) is appointed by decision of the Pułkownik and is **not** part of the activity-driven path. **Podchorąży** is the initial trial rank before full officer corps entry.
- **Warrant corps** is **non-linear**: its ranks may be granted independently of the member's previous rank.
- **Elew** is the entry rank after joining; a member must be promoted out of it within **2 months** to remain in the brigade (surfaced as a warning, not a hard block).
- **Starszy Szeregowy Specjalista** is an **optional step that is usually skipped**; it is for members active over a long time but not regularly enough to advance to the NCO corps.

Arma 3 stream:

- **Starszy Szeregowy Specjalista** is a **normal** rank (no optional/skip rule).
- **Elew** means basic training is not yet finished; the member is **automatically promoted to Szeregowy when basic training is completed**. (Basic training tracking is deferred; the automation applies once it exists, manual in the interim.)

---

## Awards

### Award attributes

`name`, `category`, `tier_group`, `tier_level`, `requirement`, `max_per_member`, `requires_reason`, `introduced_at` (nullable).

- Tiered awards share a `tier_group`; each degree is its own row with a `tier_level`. Upgrading a tiered award closes/drops the lower degree (max one held).
- `max_per_member = NULL` means unlimited; `1` means at most one.
- `requires_reason = true` means the admin must enter a reason for each grant.
- `introduced_at` records when the award was added to the catalog (nullable; supplied during seeding).
- All awards are revocable via an event and become re-grantable after revocation.

### Award definitions

**Krzyże Zasługi** — each a separate award, no tiering, unlimited per member, reason required.

| Award | Requirement |
| --- | --- |
| Złoty Krzyż Zasługi | Za wniesienie znacznego wkładu w rozwój brygady (najwyższa skala dokonanej rzeczy) |
| Srebrny Krzyż Zasługi | Za wniesienie znacznego wkładu w rozwój brygady |
| Brązowy Krzyż Zasługi | Za wniesienie wkładu w rozwój brygady |

**Krzyże okazjonalne** — each separate, max 1 per member, no reason; only Listopadowa is tiered.

| Award | Tier | Requirement |
| --- | --- | --- |
| Krzyż Kampanii Listopadowej | 1 | Za znaczne przyczynienie się do zdobycia przez dywizjon 20. miejsca w rankingu w sezonie 2023-VI |
| Krzyż Kampanii Listopadowej | 2 | Za pomoc w zdobyciu przez dywizjon 20. miejsca w rankingu w sezonie 2023-VI |
| Krzyż Kampanii Styczniowej | — | Za znaczne przyczynienie się do zdobycia przez dywizjon 50. miejsca w rankingu w sezonie 2022-I |
| Krzyż Kampanii Sierpniowej | — | Za przyczynienie się do zdobycia przez dywizjon 100. miejsca w rankingu w sezonie 2020-IV |
| Krzyż Turnieju PA3T 2023 | — | Za udział w turnieju Polish Arma 3 Tournament 2023 jako część składu meczowego |
| Odz. pamiątkowa "Meetup 2023" | — | Za udział w Meetupie 7BOW 2023 w Poznaniu |
| Odz. pamiątkowa "Meetup 2024" | — | Za udział w Meetupie 7BOW 2024 w Warszawie |
| Odz. pamiątkowa "Meetup 2025" | — | Za udział w Meetupie 7BOW 2025 w Krakowie |

**Za bitwy dywizjonowe** — each separate, unlimited per member, reason required.

| Award | Requirement |
| --- | --- |
| Wojskowy Krzyż Zasługi | Za zniszczenie 8 maszyn przeciwnika w bitwie dywizjonowej przy pomocy maszyny naziemnej |
| Lotniczy Krzyż Zasługi | Za zniszczenie 8 maszyn przeciwnika w bitwie dywizjonowej przy pomocy maszyny powietrznej |

**Za wkład w sekcję Army** — each separate, max 1 per member, reason required.

| Award | Requirement |
| --- | --- |
| Order Twórcy Misji 2023 | Za stworzenie najlepszych misji 2023 roku w jednej z 2 kategorii |
| Order Twórcy Misji 2024 | Za stworzenie najlepszych misji 2024 roku w jednej z 2 kategorii |

**Gwiazdy** — each separate, max 1 per member, no reason.

| Award | Requirement |
| --- | --- |
| Gwiazda Lubonia | Za udział w bitwie o Luboń |
| Gwiazda Studzianek | Za udział w bitwie pod Studziankami |
| Gwiazda Egiptu | Za udział w I bitwie pod El Alamein |
| Gwiazda Tomaszowa | Za udział w bitwie pod Tomaszowem Lubelskim |
| Gwiazda El Alamein | Za udział w II bitwie pod El Alamein |
| Gwiazda Falaise | Za udział w kotle Falaise |
| Gwiazda Kurska | Za udział w bitwie na łuku kurskim |
| Gwiazda Lipska | Za udział w bombardowaniu Lipska |
| Gwiazda Renu | Za udział w przekraczaniu Renu |
| Gwiazda Hürtgen | Za udział w bitwie o Las Hürtgen |

**Medale za długoletnią służbę** — tiered, max 1 per member (upgrade drops the lower degree), no reason.

| Award | Tier | Requirement |
| --- | --- | --- |
| Medal za Długoletnią Służbę | Gold | Za 5 lat służby |
| Medal za Długoletnią Służbę | Silver | Za 2 lata służby |
| Medal za Długoletnią Służbę | Bronze | Za rok służby |
