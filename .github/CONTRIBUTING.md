# Contributing Setup & Guidelines

Thanks for taking the time to contribute to the 7BOW WGST Clan Management System!

## Setting up the Development Environment

### Prerequisites

- [Bun](https://bun.sh/) (latest version)
- [PostgreSQL](https://www.postgresql.org/) (running as a local Windows service)

### 1. Clone the repository

```cmd
git clone https://github.com/7BOW-WGST/ClanManagementSystem
cd ClanManagementSystem
```

### 2. Install dependencies

```cmd
bun install
```

### 3. Database configuration

Create a local PostgreSQL database (e.g., `clan_management`) and copy `.env.example` to `.env`, setting `DATABASE_URL` to match your local database credentials.

## Building and Validation

Run the same check as the CI pipeline (`.github/workflows/ci.yml`) before opening a pull request:

```cmd
bun run typecheck
```

## Coding Guidelines

All coding standards are defined in [AGENTS.md](../AGENTS.md), which is the canonical source of truth for this repository. Refer to it for structural guardrails, TypeScript rules, database/Kysely conventions, and AI-assisted development guidelines.

### General Summary

This project follows a pragmatic, minimal-first approach tailored specifically to our lightweight tech stack:

#### 1. Architectural Guardrails (Anti-Overengineering)

- **Flat Structure:** Keep the project structure flat. Avoid deep folder nesting. Everything core should live directly in `src/` (e.g., `src/index.tsx`, `src/db.ts`).
- **Zero Bloat Policy:** Do not install new npm packages unless absolutely mandatory. Rely on Bun native APIs, Hono, and Kysely.
- **No Heavy Frameworks:** We use **Hono JSX** (Server-Side Rendering). Do **not** introduce client-side frameworks like React, Vue, or heavy state-management libraries. The UI must remain server-driven HTML.

#### 2. TypeScript Guidelines

- **Strict Mode:** TypeScript `strict` mode must never be bypassed.
- **No `any`:** Avoid using `any`. If typing is complex, define proper interfaces or types.

#### 3. Database & SQL (Kysely & PostgreSQL)

- **Direct Queries:** All database interactions must go through **Kysely**. Do not use raw SQL string concatenation or heavy ORMs.
- **Strong Typing:** Every database table must have a corresponding TypeScript interface defined in `src/db.ts`.
- **Naming Convention:** Database columns should use `snake_case`, while TypeScript properties should match standard typing.

#### 4. Code Style & Formatting

- **Small, Readable Files:** Keep files focused and short. A file should do one thing well.
- **Self-Documenting Code:** Write clean, readable code with descriptive variable names. Add comments only for non-obvious business logic.

## Pull Request Process

- Give the pull request a descriptive title following the format:
  `Component - Add|Fix|Improve|Change|Make|Remove {changes}`.
- Split large changes into separate commits.
- Update the relevant documentation if your change affects it.
- Make sure your branch is up to date with the main branch before requesting a review.
