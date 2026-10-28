# Member Core

A standalone Bun tool for the member SQLite seed database: general member identities, Discord and War Thunder account projections, and manual nickname events. It does not call Discord or War Thunder APIs.

The platform harvesters live in `../discord-parser/` and `../warthunder-parser/`. This tool consumes their JSON output.

## Commands

```cmd
cd tools\member-core
bun install
bun run import-discord-roster
bun run import-warthunder-accounts
bun run prefill-nicknames
bun run import-nicknames --dry-run
bun run import-nicknames
```

- `import-discord-roster` — imports the Discord roster JSON into `output/members.sqlite`.
- `import-warthunder-accounts` — imports the War Thunder account JSON.
- `prefill-nicknames` — writes `input/nicknames.csv` from the current roster placeholders.
- `import-nicknames` — imports manual nickname events from `input/nicknames.csv`.

The roster importers accept `--input` to override their default JSON paths.

## Tables

```sql
CREATE TABLE members (
  member_id INTEGER PRIMARY KEY,
  nickname TEXT NOT NULL,
  joined_at TEXT
);

CREATE TABLE discord_accounts (
  discord_id TEXT PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(member_id),
  username TEXT NOT NULL,
  global_name TEXT,
  server_name TEXT,
  joined_at TEXT
);

CREATE TABLE nickname_events (
  nickname_event_id INTEGER PRIMARY KEY,
  member_id INTEGER NOT NULL REFERENCES members(member_id),
  nickname TEXT NOT NULL,
  event_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  recorded_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT 'owner'
);

CREATE TABLE warthunder_accounts (
  wt_id TEXT PRIMARY KEY,
  member_id INTEGER REFERENCES members(member_id),
  username TEXT NOT NULL,
  ownership_type TEXT NOT NULL DEFAULT 'main'
    CHECK (ownership_type IN ('main', 'alt', 'borrowed')),
  squadron TEXT
    CHECK (squadron IN ('7BOW', '7BOWs', '7BOWr')),
  squadron_role TEXT,
  squadron_joined_at TEXT
);
```

- `members.nickname` is a convenience current value. Until a manual event exists, the Discord importer fills it with `server_name ?? global_name ?? username`.
- `nickname_events` is the authoritative manual nickname history. The Discord placeholder never creates an event.
- The current nickname is the latest manual event by `event_at DESC`, then `recorded_at DESC`, then `nickname_event_id DESC`.
- `members` and `nickname_events` persist across imports. Historically seen members stay in `members`; `discord_accounts` is replaced with the current roster only.
- `discord_accounts.member_id` links current platform accounts to general members.
- `warthunder_accounts` is the current War Thunder projection. `member_id` may be null until an account is matched or manually linked. New accounts default to `ownership_type = 'main'`; re-imports preserve manual `member_id` and `ownership_type` changes.
- All timestamps are full ISO 8601 UTC text.

## Nickname CSV

`input/nicknames.csv` is editable and has exactly two columns:

```csv
discord_id,nickname
123456789012345678,KKamilS
```

- `discord_id` and `nickname` are required; extra columns are ignored.
- `event_at` defaults to the member's `joined_at`.
- Members without `joined_at` are rejected.
- Only current Discord IDs from `discord_accounts` are accepted.
- Duplicate events are skipped, so repeated imports are safe.
- `prefill-nicknames` refuses to overwrite a CSV with data unless `--force` is passed.

## War Thunder Accounts

```cmd
bun run import-warthunder-accounts --dry-run
bun run import-warthunder-accounts
```

Default input: `../warthunder-parser/output/warthunder-accounts.json`.

- Accounts are matched by exact WT username against `members.nickname`, then case-insensitive matches, then `discord_accounts` names.
- Unmatched or ambiguous accounts keep `member_id NULL`; the CLI lists them for manual resolution.
- Existing non-null `member_id` and `ownership_type` values are preserved on re-import.
- New accounts default to `ownership_type = 'main'`.
- Updates refresh `username`, `squadron`, `squadron_role`, and `squadron_joined_at`.
- `squadron_joined_at` is a full ISO 8601 UTC timestamp.
- Manually correcting `member_id` or `ownership_type` in SQLite survives future imports.

## Schema Conventions

- Table names are plural `snake_case`.
- Primary keys use `<entity>_id`.
- Natural platform identifiers may be primary keys when already entity-specific (`discord_accounts.discord_id`, `warthunder_accounts.wt_id`).
- Foreign keys use the referenced `<entity>_id`.
- All timestamps are full ISO 8601 UTC text.

## Validation

```cmd
cd tools\member-core
bun run typecheck
bun test
```

`output/*.sqlite` is gitignored. The main ERP schema is untouched.
