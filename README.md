<h1 align="center">7BOW WGST Clan Management System</h1>

A lightweight, server-rendered clan ERP and management dashboard designed for a **War Thunder** and **Arma 3** gaming community. The system tracks member lifecycle history, community nicknames, core/section ranks, awards, and multi-platform account associations over time.

## Key Features

- **Member Management:** Tracks community members, lifecycle events (joins, leaves, kicks), rank changes, awards, and statuses.
- **Multi-Platform Accounts:** Distinguishes concepts of member identity from external platform and game accounts - supporting Discord, War Thunder, Arma 3 Units and Steam.
- **History Trakcing:** Preserves historical records for anything that changes over time (nicknames, ranks, platform linkages and relations).
- **Source Auditability:** Distinguishes manual administrative entries from automated data, with manual inputs taking priority.
- **Role-Based Access:** Secure, role-restricted dashboard access tailored for Owners, Administrators, and Members.

## Tech Stack

- **Runtime & Package Manager:** [Bun](https://bun.sh/)
- **Web Framework:** [Hono](https://hono.dev/) (Server-Side Rendering via Hono JSX)
- **Database Query Builder:** [Kysely](https://kysely.dev/)
- **Database Driver:** `pg` (PostgreSQL running as a local Windows service)
- **UI Framework:** Bootstrap 5 (loaded strictly via CDN)

## Quick Start

### Prerequisites

- Installed **Bun** runtime
- Active local **PostgreSQL** instance (e.g. database `test_clan_db`)

### Step-by-Step

1. **Clone the repository:**

   ```cmd
   git clone https://github.com/7BOW-WGST/ClanManagementSystem
   cd ClanManagementSystem
   ```

2. **Install dependencies:**

   ```cmd
   bun install
   ```

3. **Run the development server (Hot Reload):**

   ```cmd
   bun run --watch src/index.tsx
   ```

   Access the dashboard at `http://localhost:3000`.

## Documentation & Development

AI-assisted and human contributions are governed by strict project standards:

- [`AGENTS.md`](./AGENTS.md) - Source of truth for AI assistants and technical standards.
- [`REQUIREMENTS.md`](./REQUIREMENTS.md) - Product requirements, domain concepts, and phasing.
- [`CONTRIBUTING.md`](/.github/CONTRIBUTING.md) - Contribution rules and git workflow guidelines.
