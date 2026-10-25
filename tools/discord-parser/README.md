# Discord Roster Harvester

A standalone Bun tool that fetches the current members of a Discord guild and writes a minimal player-base JSON file for later seed work.

This is research tooling under `tools/discord-parser/`; it is not part of the Clan Management System runtime.

## Requirements

- Bun >= 1.4
- A Discord bot that is already a member of the target guild
- The **Server Members** privileged intent enabled in the Discord Developer Portal
- Bot permissions: **View Channels** (the member-list endpoint additionally requires the Server Members intent)

The endpoint returns **current members only**. Members who already left the server are not included; those must come from message/log channels later.

## Setup

```cmd
cd tools\discord-parser
bun install
copy .env.example .env
```

Fill in `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID`, and `DISCORD_MEMBER_ROLE_IDS` in `.env`. The role variable is a comma-separated list of qualifying role IDs; a member must have at least one of them to be treated as a clan member. The harvester reads this tool-local file explicitly, so it does not depend on the repository-root `.env`.

For the current 7BOW setup:

```dotenv
DISCORD_MEMBER_ROLE_IDS=526133207339368459,827554967103340585
```

These are `Członek Brygady` and `Weteran`. Members holding either role qualify; holding both produces both IDs in `matched_role_ids`.

## Usage

```cmd
cd tools\discord-parser
bun run harvest-members
```

Useful options:

```cmd
bun run harvest-members --limit 10          # smoke test
bun run harvest-members --include-bots      # debugging only
bun run harvest-members --include-pending   # debugging only
bun run harvest-members --output .\output\roster.json
```

Bots, pending members, and members without a qualifying role are excluded by default. The run prints counts for fetched, kept, bot, pending, and role-filtered members.

## Output

`output/discord-members.json`:

```json
{
  "meta": {
    "guild_id": "123456789012345678",
    "guild_name": "7BOW",
    "fetched_at": "2026-10-24T12:00:00.000Z",
    "source": "auto",
    "bot_user_id": "987654321098765432",
    "bot_user_name": "Clan Harvester",
    "fetched_count": 250,
    "kept_count": 246,
    "bot_count": 4,
    "pending_count": 0,
    "role_filtered_count": 12,
    "required_role_ids": [
      "526133207339368459",
      "827554967103340585"
    ]
  },
  "members": [
    {
      "discord_id": "123456789012345678",
      "username": "kamil",
      "global_name": "Kamil",
      "server_name": "KKamilS",
      "joined_at": "2020-04-12T18:00:00.000000+00:00",
      "matched_role_ids": [
        "526133207339368459"
      ]
    }
  ]
}
```

Fields:

- `discord_id` — stable Discord snowflake, stored as text.
- `username` — Discord account handle.
- `global_name` — Discord display name. Stays `null` when the account has no global display name.
- `server_name` — guild nickname. Stays `null` when the member has no server nickname; the tool does not fabricate one.
- `joined_at` — when the member joined this Discord server, as the raw Discord timestamp. This is not the clan join date and may be `null`.
- `matched_role_ids` — the configured qualifying roles the member holds, in configured order. Never empty in the output.

Members are sorted by server name (falling back to username), then by username and Discord ID.

## Cache

Raw roster snapshots are upserted into `cache/discord.sqlite` using Bun's native `bun:sqlite`. The cache preserves `first_seen_at`, refreshes `last_seen_at`, and records each roster run. It does **not** infer departures from absence.

Existing cache files are migrated automatically: missing `global_name`, `joined_at`, and `matched_role_ids_json` columns are added with `ALTER TABLE`, as is `roster_runs.role_filtered_count`. No cache wipe is required. Older rows keep `null`/empty values until the next harvest updates them.

`cache/` and `output/raw/` are gitignored. The roster JSON is intended to be kept as the seed-base artifact.

## Members SQLite export

```cmd
cd tools\discord-parser
bun run export-members
```

This reads `output/discord-members.json` and writes `output/members.sqlite` with two tables:

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
```

- `members` is platform-neutral. Its nickname is a placeholder derived from `server_name`, then `global_name`, then `username`.
- `members.joined_at` and `discord_accounts.joined_at` are full ISO 8601 UTC timestamps, e.g. `2020-05-06T22:30:00.000Z`.
- Member IDs are preserved across exports for Discord accounts that remain in the roster. New accounts receive the next free ID.
- Both tables are replaced on each export; unrelated tables are untouched.

### Schema conventions

These rules apply to this tool's SQLite output only; the main ERP schema is unchanged.

- Table names are plural `snake_case`.
- Primary keys use `<entity>_id`, e.g. `members.member_id`.
- A natural platform identifier may be the primary key when it is already entity-specific, e.g. `discord_accounts.discord_id`.
- Foreign keys use the referenced `<entity>_id`.
- Timestamps are stored as ISO 8601 UTC text (`YYYY-MM-DDTHH:mm:ss.sssZ`).
- Calendar dates, if introduced later, use ISO 8601 `YYYY-MM-DD`.

Optional overrides:

```cmd
bun run export-members --input .\output\discord-members.json --output .\output\members.sqlite
```

`output/*.sqlite` is gitignored; regenerate it from the roster JSON when needed.

## Validation

```cmd
cd tools\discord-parser
bun run typecheck
bun test
```

The tool has its own `package.json` and `tsconfig.json`. The repository-root `tsconfig.json` excludes `tools/`, so the app typecheck does not try to resolve tool-local dependencies.
