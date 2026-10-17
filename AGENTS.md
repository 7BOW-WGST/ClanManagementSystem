# AI-Assisted Coding Standards

## 1. Purpose & Scope

This file is the **canonical source of truth** for coding standards in the Clan Management System. It governs both AI assistants and human contributors.

- **Applies to:** AI-assisted and manual development across the whole repository.
- **Precedence:** a direct user instruction > this file > [`CONTRIBUTING.md`](./.github/CONTRIBUTING.md) > general defaults.
- **Out of scope:** product requirements and phasing live in [`REQUIREMENTS.md`](./docs/development/REQUIREMENTS.md); setup instructions live in [`README.md`](./README.md) and [`CONTRIBUTING.md`](./.github/CONTRIBUTING.md).

---

## 2. Project Overview & Domain Requirements

The Clan Management System is a **lightweight, native-first, modular management platform for a gaming clan**, built with **Bun, Hono JSX (SSR), Kysely, PostgreSQL**, and **Bootstrap 5 (CDN)**. It is developed locally on Windows and deployed to a dedicated production server. It tracks each member's history, status, and activity, and the clan's overall statistics, through a web dashboard.

Key domain requirements (see [`REQUIREMENTS.md`](./docs/development/REQUIREMENTS.md) for detail):

- **Temporal Data (History Tracking):** tracks complex historical changes (e.g. nicknames, ranks, status changes with start/end dates).
- **Multi-Platform Architecture:** distinguishes core member identity from external platforms: **Discord**, **War Thunder**, **Arma 3**, and **Steam**.
- **Auditability & Manual Input:** supports heavy administrative manual input for historical data, requiring clear identification (`source: manual` vs `auto`).

---

## 3. Core Principles

- **Zero Bloat & No Overengineering:** do not install new packages or external libraries unless explicitly instructed by the user. Rely on Bun's native APIs and existing packages.
- **No Heavy Front-end Frameworks:** this is a **Server-Side Rendered (SSR)** application using **Hono JSX**. Do NOT introduce React, Vue, Svelte, Tailwind build tools, Vite, or client-side bundlers.
- **Shallow, Domain-Oriented Structure:** keep the code base simple and organized by domain inside `src/` (`src/db/`, `src/lib/`, and one folder per domain such as `src/members/`). Avoid deep nesting or unnecessary abstraction layers (e.g. no `adapters/`, `factories/`, `use-cases/` for simple CRUD tasks).
- **Direct & Predictable:** code must be simple enough to be completely understood at a glance. No hidden framework "magic".

---

## 4. Tech Stack & Environment

- **Runtime & Package Manager:** Bun (>= 1.4)
- **Web Framework:** Hono (using JSX for HTML SSR)
- **Database Query Builder:** Kysely
- **Database Driver:** `pg` (PostgreSQL running as a local Windows service)
- **CSS Framework:** Bootstrap 5 (loaded strictly via CDN)
- **Platform Target:** Windows (native PowerShell / CMD execution)

---

## 5. Project Structure

Core code lives under `src/`, organized by domain with a small shared core:

- `src/index.tsx` — Hono server bootstrap (starts the HTTP server).
- `src/app.tsx` — Hono app creation, global middleware, and mounting of domain routers.
- `src/config.ts` — environment configuration.
- `src/db/` — database: `client.ts` (Kysely instance), `pg.ts`, `types.ts` (table interfaces), `migrations.ts` + `migrations/`, and the `migrate.ts` / `seed.ts` scripts.
- `src/lib/` — shared helpers (`date.ts`, `projection.ts`, `validation.ts`, `role.ts`, `middleware.ts`, `layout.tsx`).
- `src/<domain>/` — one folder per domain holding `data.ts`, `routes.tsx`, and `views.tsx` (e.g. `src/members/`).

Every database table must have its interface declared in `src/db/types.ts`.

---

## 6. Coding Standards

### 6.1 TypeScript

- **Strict Typing:** TypeScript strict mode is enforced. Bypassing types using `any` or loose type assertions (`as unknown`) is strictly prohibited. Define proper interfaces.
- **Verbatim Module Syntax:** explicitly use type-only imports/exports when referencing types:

  ```ts
  import { Kysely, PostgresDialect, type Generated } from 'kysely'
  ```

- **No Client-Side React Hooks:** Hono JSX renders plain HTML on the server. Do not use React-specific hooks like `useState`, `useEffect`, or `useContext`.

### 6.2 Database & Kysely

- **Explicit Queries:** all PostgreSQL queries must be executed via the Kysely query builder. Do not write raw SQL string concatenations or introduce ORMs (e.g. Prisma, Drizzle).
- **Schema Synchronization:** every database table must have its corresponding interface declared in `src/db/types.ts`.
- **Database Types:** use Kysely's `Generated<T>` type for auto-incrementing primary keys (`SERIAL`).
- **Naming Conventions:**
  - Database tables and columns: `snake_case`
  - TypeScript interface names: `PascalCase`; interface property names: `snake_case`, matching the column names exactly (Kysely uses property names as column names — no implicit mapping or CamelCase plugin).

### 6.3 Hono & JSX

- **JSX Attributes:** HTML attribute names in Hono JSX must be lowercase (e.g. `method="post"`, not `method="POST"`).
- **Form Handling:** prefer native HTML forms with `POST` requests and `c.req.parseBody()` over complex AJAX / WebSocket mechanics, unless real-time functionality is explicitly requested.
- **Context Access:** route handlers receive the Hono context `c`. Use `c.html()` for rendering JSX, `c.json()` for APIs, and `c.redirect()` for post-mutation navigation.

### 6.4 UI & Styling

- **Bootstrap via CDN only:** load Bootstrap 5 strictly from its CDN. Do not add CSS build tooling or vendored stylesheets.
- **Server-rendered HTML:** the UI must remain server-driven; no client-side templating or state-management libraries.

---

## 7. Operational Commands

When validating or running code, use these exact commands:

- **Development Server (Hot Reload):**

  ```cmd
  bun run --watch src/index.tsx
  ```

- **Type Checking (CI Validation):**

  ```cmd
  bun run typecheck
  ```

- **Install Packages (Only if explicitly requested or approved):**

  ```cmd
  bun add <package-name>
  ```

---

## 8. Agent Behavioral Guidelines

1. **Strict Anti-Hallucination Policy:** never guess, assume, or fabricate database table names, column schemas, Kysely interface properties, API response shapes, or non-existent framework features.
2. **Verify Before Proposing:** always double-check TypeScript syntax, types in `src/db/types.ts`, and imports against existing codebase conventions before outputting code.
3. **Ask When Uncertain:** if precise data, schema definitions, or environment details are missing, or a rule cannot be met, ask the user directly for clarification instead of generating speculative code.
4. **Surgical Changes:** make minimal, focused edits. Do not rewrite surrounding code or refactor unrelated logic unless asked.
5. **Respect Environment Constraints:** the host system is Windows. Avoid assuming Linux-specific shell syntax (e.g. use PowerShell/CMD compatible commands when suggesting CLI operations).
6. **No Automated Git Operations:** never execute `git commit`, `git push`, or other automated git write operations unless the user explicitly asks for it. Otherwise, all version control steps are performed manually by the user.

---

## 9. Quick Reference

| Always | Never |
| --- | --- |
| Use the Kysely query builder | Write raw SQL string concatenations, or add ORMs |
| Declare every table in `src/db/types.ts` | Fabricate table/column/interface names |
| Use `Generated<T>` for `SERIAL` keys | Bypass types with `any` or `as unknown` |
| Use type-only imports (`type X`) | Use uppercase JSX attributes |
| Use native forms + `c.req.parseBody()` | Add React/Vue/Svelte/hooks or client bundlers |
| Use `c.html()` / `c.json()` / `c.redirect()` | Install packages without explicit approval |
| Run `bun run typecheck` before finishing | Run `git commit`/`git push` unprompted |
| Ask when data or rules are unclear | Assume Linux-specific shell syntax |
