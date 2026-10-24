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

Fill in `DISCORD_BOT_TOKEN` and `DISCORD_GUILD_ID` in `.env`. The harvester reads this tool-local file explicitly, so it does not depend on the repository-root `.env`.

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

Bots and pending members are excluded by default. The run prints counts for fetched, kept, bot, and pending members.

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
    "pending_count": 0
  },
  "members": [
    {
      "discord_id": "123456789012345678",
      "username": "kamil",
      "server_name": "KKamilS"
    }
  ]
}
```

Fields:

- `discord_id` — stable Discord snowflake, stored as text.
- `username` — Discord account handle.
- `server_name` — guild nickname. Stays `null` when the member has no server nickname; the tool does not fabricate one.

Members are sorted by server name (falling back to username), then by username and Discord ID.

## Cache

Raw roster snapshots are upserted into `cache/discord.sqlite` using Bun's native `bun:sqlite`. The cache preserves `first_seen_at`, refreshes `last_seen_at`, and records each roster run. It does **not** infer departures from absence.

`cache/` and `output/raw/` are gitignored. The roster JSON is intended to be kept as the seed-base artifact.

## Validation

```cmd
cd tools\discord-parser
bun run typecheck
bun test
```

The tool has its own `package.json` and `tsconfig.json`. The repository-root `tsconfig.json` excludes `tools/`, so the app typecheck does not try to resolve tool-local dependencies.
