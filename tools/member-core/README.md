# Member Core

A standalone Bun tool for the member SQLite seed database: general member identities, Discord account links, and manual nickname events. It does not call the Discord API.

The Discord-specific harvester lives in `../discord-parser/` and writes `../discord-parser/output/discord-members.json`. This tool consumes that file.

## Commands

```cmd
cd tools\member-core
bun install
bun run import-discord-roster
bun run prefill-nicknames
bun run import-nicknames --dry-run
bun run import-nicknames
```

- `import-discord-roster` — imports the Discord roster JSON into `output/members.sqlite`.
- `prefill-nicknames` — writes `input/nicknames.csv` from the current roster placeholders.
- `import-nicknames` — imports manual nickname events from `input/nicknames.csv`.

Both roster-consuming commands accept `--input` to override the default Discord JSON path.

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
```

- `members.nickname` is a convenience current value. Until a manual event exists, the Discord importer fills it with `server_name ?? global_name ?? username`.
- `nickname_events` is the authoritative manual nickname history. The Discord placeholder never creates an event.
- The current nickname is the latest manual event by `event_at DESC`, then `recorded_at DESC`, then `nickname_event_id DESC`.
- `members` and `nickname_events` persist across imports. Historically seen members stay in `members`; `discord_accounts` is replaced with the current roster only.
- `discord_accounts.member_id` links current platform accounts to general members.
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

## Schema Conventions

- Table names are plural `snake_case`.
- Primary keys use `<entity>_id`.
- Natural platform identifiers may be primary keys when already entity-specific (`discord_accounts.discord_id`).
- Foreign keys use the referenced `<entity>_id`.
- All timestamps are full ISO 8601 UTC text.

## Validation

```cmd
cd tools\member-core
bun run typecheck
bun test
```

`output/*.sqlite` is gitignored. The main ERP schema is untouched.
