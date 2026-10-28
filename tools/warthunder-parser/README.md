# War Thunder Roster Harvester

A standalone Bun tool that scrapes the 7BOW squadron page and resolves War Thunder account IDs through the companion-app search endpoint.

It does **not** use the replay page and does not require a login.

## Why not the replay page?

The replay page redirects to Gaijin SSO and requires a logged-in browser session. The companion-app endpoint used by community tools is public and returns nickname → account ID directly:

```text
https://companion-app.warthunder.com/call/
  ?classname=eaw_Contacts
  &method=jzx_findUsersByNickPrefix
  &count=100
  &nick=<nickname>
  &v=9
```

The endpoint is undocumented/internal, so this tool caches successful lookups, rate-limits requests, and reports unresolved names instead of guessing.

## Setup

```cmd
cd tools\warthunder-parser
bun install
copy .env.example .env
```

Default configuration targets the 7BOW clan page.

## Usage

```cmd
cd tools\warthunder-parser
bun run harvest
```

Smoke test:

```cmd
bun run harvest --limit 5
```

Useful options:

```cmd
bun run harvest --refresh          # ignore nickname cache
bun run harvest --delay-ms 500     # slower companion API requests
bun run harvest --output .\output\warthunder-accounts.json
```

## Output

`output/warthunder-accounts.json`:

```json
{
  "meta": {
    "fetched_at": "2026-10-28T12:00:00.000Z",
    "clan_url": "https://warthunder.com/en/community/claninfo/...",
    "squadron": "7BOW",
    "clan_name": "7 Brygada Obrony Wybrzeza",
    "clan_tag": "┾7BOW┿",
    "member_count": 118,
    "processed_count": 118,
    "resolved_count": 110,
    "unresolved_count": 8
  },
  "accounts": [
    {
      "wt_id": "35784730",
      "username": "WOJTEK885",
      "squadron": "7BOW",
      "squadron_role": "Commander",
      "squadron_joined_at": "2020-04-28T00:00:00.000Z"
    }
  ],
  "unresolved": [
    {
      "username": "Example",
      "reason": "no_exact_match",
      "candidates": []
    }
  ]
}
```

- Only exact, case-sensitive nickname matches become accounts.
- `DD.MM.YYYY` clan dates are converted to full ISO 8601 UTC timestamps.
- Unresolved entries include `no_exact_match`, `ambiguous_exact_match`, or `lookup_failed`.
- Candidate lists are included to help resolve names manually.

## Cache

`cache/warthunder.sqlite` stores:

- resolved nickname → WT ID mappings
- parsed clan member snapshots

Cached positive lookups are reused on the next run. `--refresh` bypasses the nickname cache.

`cache/` and `output/*.json` are gitignored.

## Handoff

Import the output into member-core:

```cmd
cd ..\member-core
bun run import-warthunder-accounts
```

The member-core importer links accounts to existing members by exact/case-insensitive nickname and Discord names, and leaves unmatched accounts with `member_id NULL`.

## Validation

```cmd
cd tools\warthunder-parser
bun run typecheck
bun test
```
