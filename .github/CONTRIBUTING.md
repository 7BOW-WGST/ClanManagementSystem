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

Create a local PostgreSQL database (e.g., `test_cms_db`) and ensure your connection settings in `.env` match your local database credentials.

## Building and Validation

Run the same checks as the CI pipelines before opening a pull request:

```cmd
TODO: Add checks
```

## Coding Guidelines

This project follows a pragmatic, minimal-first approach tailored specifically to our lightweight tech stack:

### 1. Architectural Guardrails (Anti-Overengineering)

- **Flat Structure:** Keep the project structure flat. Avoid deep folder nesting. Everything core should live directly in `src/` (e.g., `src/index.tsx`, `src/db.ts`).
- **Zero Bloat Policy:** Do not install new npm packages unless absolutely mandatory. Rely on Bun native APIs, Hono, and Kysely.
- **No Heavy Frameworks:** We use **Hono JSX** (Server-Side Rendering). Do **not** introduce client-side frameworks like React, Vue, or heavy state-management libraries. The UI must remain server-driven HTML.

### 2. TypeScript Guidelines

- **Strict Mode:** TypeScript `strict` mode must never be bypassed.
- **No `any`:** Avoid using `any`. If typing is complex, define proper interfaces or types.

### 3. Database & SQL (Kysely & PostgreSQL)

- **Direct Queries:** All database interactions must go through **Kysely**. Do not use raw SQL string concatenation or heavy ORMs.
- **Strong Typing:** Every database table must have a corresponding TypeScript interface defined in `src/db.ts`.
- **Naming Convention:** Database columns should use `snake_case`, while TypeScript properties should match standard typing.

### 4. Code Style & Formatting

- **Small, Readable Files:** Keep files focused and short. A file should do one thing well.
- **Self-Documenting Code:** Write clean, readable code with descriptive variable names. Add comments only for non-obvious business logic.

Additional conventions, mainly for AI assisted development, can be found in [AGENTS.md](./AGENTS.md).

## Pull Request Process

- Give the pull request a descriptive title following the format:
  `Component - Add|Fix|Improve|Change|Make|Remove {changes}`.
- Split large changes into separate commits.
- Update the documentation in [`docs/`](../docs) if your change affects it.
- Make sure your branch is up to date with the main branch before requesting a review.
