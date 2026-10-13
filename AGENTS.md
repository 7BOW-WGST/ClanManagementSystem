# AI-Assisted Coding Standards

The Clan Management System is a **minimalist, native-first, modular management platform for a gaming clan** built with **Bun, Hono JSX (SSR), Kysely, PostgreSQL**, and **Bootstrap 5 (CDN)** running directly on a local Windows environment. It tracks each member's history, status, and activity, and the clan's overall statistics, through a web dashboard.

Key Domain Requirements:

- **Temporal Data (History Tracking):** Tracks complex historical changes (e.g. nicknames, ranks, status changes with start/end dates).
- **Multi-Platform Architecture:** Distinguishes core member identity from external platforms: **Discord**, **War Thunder**, **Arma 3**, and **Steam**.
- **Auditability & Manual Input:** Supports heavy administrative manual input for historical data, requiring clear identification (`source: manual` vs `auto`).

---

## 1. Core Philosophy & Non-Negotiables

- **Zero Bloat & No Overengineering:** Do not install new packages or external libraries unless explicitly instructed by the user. Rely on Bun's native APIs and existing packages.
- **No Heavy Front-end Frameworks:** This is a **Server-Side Rendered (SSR)** application using **Hono JSX**. Do NOT introduce React, Vue, Svelte, Tailwind build tools, Vite, or client-side bundlers.
- **Flat Project Structure:** Keep the code base clean, simple, and flat inside `src/`. Avoid deeply nested directories or unnecessary abstraction layers (e.g., no enterprise patterns like `adapters/`, `factories/`, `use-cases/` for simple CRUD tasks).
- **Direct & Predictable:** Code must be simple enough to be completely understood at a glance. No hidden framework "magic".

---

## 2. Tech Stack & Environment

- **Runtime & Package Manager:** Bun (latest)
- **Web Framework:** Hono (using JSX for HTML SSR)
- **Database Query Builder:** Kysely
- **Database Driver:** `pg` (PostgreSQL running as a local Windows service)
- **CSS Framework:** Bootstrap 5 (loaded strictly via CDN)
- **Platform Target:** Windows (native PowerShell / CMD Execution)

---

## 3. Mandatory Coding Standards

### TypeScript

- **Strict Typing:** TypeScript strict mode is enforced. Bypassing types using `any` or loose type assertions (`as unknown`) is strictly prohibited. Define proper interfaces.
- **Verbatim Module Syntax:** Explicitly use type-only imports/exports when referencing types:

  ```ts
  import { Kysely, PostgresDialect, type Generated } from 'kysely'
  ```

- **No Client-Side React Hooks:** Hono JSX renders plain HTML on the server. Do not use React-specific hooks like useState, useEffect, or useContext.

### Database & Kysely

- **Explicit Queries:** All PostgreSQL queries must be executed via Kysely query builder. Do not write raw SQL string concatenations or introduce ORMs (e.g., Prisma, Drizzle).
- **Schema Synchronization:** Every database table must have its corresponding interface declared in `src/db.ts`.
- **Database Types:** Use Kysely's `Generated<T>` type for auto-incrementing primary keys (`SERIAL`).
- **Naming Conventions:**
  - Database tables and columns: `snake_case`
  - TypeScript interfaces and properties: `PascalCase` / `camelCase` matching table definitions.

### Hono & HTML Rendering

- **JSX Attributes:** HTML attribute names in Hono JSX must be lowercase (e.g., `method="post"`, not `method="POST"`).
- **Form Handling:** Prefer native HTML forms with `POST` requests and `c.req.parseBody()` over complex AJAX / WebSocket mechanics, unless real-time functionality is explicitly requested.
- **Context Access:** Route handlers receive the Hono context `c`. Use `c.html()` for rendering JSX, `c.json()` for APIs, and `c.redirect()` for post-mutation navigation.

## 4. Operational Commands

When validating or running code, use these exact commands:

- Development Server (Hot Reload):

```cmd
bun run --watch src/index.tsx
```

- Type Checking (CI Validation):

```cmd
bun x tsc --noEmit
```

- Install Packages (Only if explicitly requested or approved):

```cmd
bun add <package-name>
```

## 5. Agent Behavioral Guidelines

1. **Strict Anti-Hallucination Policy:** Never guess, assume, or fabricate database table names, column schemas, Kysely interface properties, API response shapes, or non-existent framework features.
2. **Verify Before Proposing:** Always double-check TypeScript syntax, types in `src/db.ts`, and imports against existing codebase conventions before outputting code.
3. **Ask When Uncertain:** If precise data, schema definitions, or environment details are missing, or a rule cannot be met, ask the user directly for clarification instead of generating speculative code.
4. **Surgical Changes:** Make minimal, focused edits. Do not rewrite surrounding code or refactor unrelated logic unless asked.
5. **Respect Environment Constraints:** The host system is Windows. Avoid assuming Linux-specific shell syntax (e.g., use PowerShell/CMD compatible commands when suggesting CLI operations).
6. **No Automated Git Operations:** Never execute `git commit`, `git push`, or other automated git write operations unless the user explicitly asks for it. Otherwise, all version control steps are performed manually by the user.
