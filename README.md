# 7BOW WGST Clan Management System

A minimalist, server-rendered clan ERP and management dashboard designed for a **War Thunder** and **Arma 3** gaming community. The system tracks member lifecycle history, community nicknames, core/section ranks, awards, and multi-platform account associations over time.

---

## Tech Stack

- **Runtime & Package Manager:** [Bun](https://bun.sh/)
- **Web Framework:** [Hono](https://hono.dev/) (Server-Side Rendering via Hono JSX)
- **Database Query Builder:** [Kysely](https://kysely.dev/)
- **Database Driver:** `pg` (PostgreSQL running as a local Windows service)
- **UI Framework:** Bootstrap 5 (loaded strictly via CDN)

---

## Quick Start (Development)

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

4. **Type-check the codebase:**

   ```cmd
   bun x tsc --noEmit
   ```

---

## Core Philosophy & Principles

- **Zero Bloat & SSR Native:** No heavy client-side frameworks (React, Vue, Vite) or build tools. Renders pure HTML on the server.
- **Temporal Data Tracking:** Preserves historical states (nicknames, rank durations, membership lifecycle events) using time-bounded validity (`start_date` / `end_date`).
- **Multi-Platform Architecture:** Separates core community identity from external platform accounts (Discord, War Thunder squadrons, Arma3Units, Steam).
- **Auditability (`manual` vs `auto`):** Administrative manual inputs take precedence over automated bot data and are explicitly tagged to ensure source auditability.

---

## Governance & Documentation

AI-assisted and human contributions are governed by strict project standards:

- **`AGENTS.md`** — Source of truth for AI assistants and technical standards.
- **`REQUIREMENTS.md`** — Product requirements, domain concepts, and phasing.
- **`CONTRIBUTING.md`** — Contribution rules and git workflow guidelines.
