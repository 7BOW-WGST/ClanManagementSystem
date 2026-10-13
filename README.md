<h1 align="center">7BOW WGST Clan Management System</h1>

A lightweight, server-rendered clan ERP and management dashboard designed for a **War Thunder** and **Arma 3** gaming community. The system tracks member lifecycle history, community nicknames, core/section ranks, awards, and multi-platform account associations over time.

## Key Features

- **Member Management:** Tracks community members, lifecycle events (joins, leaves, kicks), rank changes, awards, and statuses.
- **Multi-Platform Accounts:** Distinguishes concepts of member identity from external platform and game accounts - supporting Discord, War Thunder, Arma 3 Units and Steam.
- **History Tracking:** Preserves historical records for anything that changes over time (nicknames, ranks, platform linkages and relations).
- **Source Auditability:** Distinguishes manual administrative entries from automated data, with manual inputs taking priority.
- **Role-Based Access:** Secure, role-restricted dashboard access tailored for Owners, Administrators, and Members.

## Tech Stack

- **Runtime & Package Manager:** [Bun](https://bun.sh/) (>= 1.4)
- **Web Framework:** [Hono](https://hono.dev/) (Server-Side Rendering via Hono JSX)
- **Database Query Builder:** [Kysely](https://kysely.dev/)
- **Database Driver:** `pg` (PostgreSQL running as a local Windows service)
- **UI Framework:** Bootstrap 5 (loaded strictly via CDN)

## Quick Start

### Prerequisites

- Installed **Bun** runtime (>= 1.4)
- Active local **PostgreSQL** instance (e.g. database `clan_management`)

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

3. **Configure the environment:**

   Copy `.env.example` to `.env` and set `DATABASE_URL` to match your local PostgreSQL instance.

4. **Run the development server (Hot Reload):**

   ```cmd
   bun run --watch src/index.tsx
   ```

   > **Note:** the application is currently a scaffold. The Hono server, routes, and dashboard are not implemented yet.

## Documentation & Development

AI-assisted and human contributions are governed by strict project standards:

- [`AGENTS.md`](./AGENTS.md) - Source of truth for coding standards, serving AI assistants and human contributors.
- [`REQUIREMENTS.md`](./REQUIREMENTS.md) - Product requirements, domain concepts, and phasing.
- [`docs/DECISIONS.md`](./docs/DECISIONS.md) - Resolved domain-model and architecture decisions.
- [`CONTRIBUTING.md`](./.github/CONTRIBUTING.md) - Contribution rules and git workflow guidelines.
