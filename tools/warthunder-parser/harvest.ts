import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { WtCache } from './cache'
import { fetchClanPage, parseClanPage } from './clan-page'
import { findExactNickname, type CompanionCandidate } from './companion'
import { loadConfig } from './config'

interface CliOptions {
  limit?: number
  refresh: boolean
  delayMs?: number
  output?: string
  help: boolean
}

interface WtAccount {
  wt_id: string
  username: string
  squadron: string
  squadron_role: string | null
  squadron_joined_at: string
}

type UnresolvedReason = 'no_exact_match' | 'ambiguous_exact_match' | 'lookup_failed'

interface UnresolvedMember {
  username: string
  reason: UnresolvedReason
  candidates: CompanionCandidate[]
  error?: string
}

interface WtOutput {
  meta: {
    fetched_at: string
    clan_url: string
    squadron: string
    clan_name: string
    clan_tag: string
    member_count: number
    processed_count: number
    resolved_count: number
    unresolved_count: number
  }
  accounts: WtAccount[]
  unresolved: UnresolvedMember[]
}

const HELP = `Usage: bun run harvest [options]

Harvest the War Thunder squadron roster and resolve account IDs.

Options:
  --limit <n>       Process at most n members (smoke testing)
  --refresh         Ignore the nickname ID cache
  --delay-ms <n>    Delay between companion API lookups
  --output <path>   Override the JSON output path
  -h, --help        Show this help
`

function positiveInteger(raw: string | undefined, flag: string): number {
  if (raw === undefined) {
    throw new Error(`${flag} requires a value.`)
  }
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${flag} must be a positive integer.`)
  }
  return value
}

function nonNegativeInteger(raw: string | undefined, flag: string): number {
  if (raw === undefined) {
    throw new Error(`${flag} requires a value.`)
  }
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${flag} must be a non-negative integer.`)
  }
  return value
}

function parseCli(argv: string[]): CliOptions {
  const options: CliOptions = { refresh: false, help: false }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    switch (argument) {
      case '--limit':
        index += 1
        options.limit = positiveInteger(argv[index], '--limit')
        break
      case '--refresh':
        options.refresh = true
        break
      case '--delay-ms':
        index += 1
        options.delayMs = nonNegativeInteger(argv[index], '--delay-ms')
        break
      case '--output':
        index += 1
        if (argv[index] === undefined) {
          throw new Error('--output requires a value.')
        }
        options.output = argv[index]
        break
      case '-h':
      case '--help':
        options.help = true
        break
      default:
        throw new Error(`Unknown argument: ${argument ?? ''}`)
    }
  }

  return options
}

async function main(): Promise<void> {
  const cli = parseCli(Bun.argv.slice(2))
  if (cli.help) {
    console.log(HELP)
    return
  }

  const config = await loadConfig()
  const outputPath =
    cli.output === undefined ? config.outputPath : resolve(process.cwd(), cli.output)
  const delayMs = cli.delayMs ?? config.searchDelayMs

  const html = await fetchClanPage(
    config.clanUrl,
    config.requestTimeoutMs,
    config.userAgent,
  )
  const page = parseClanPage(html, config.clanUrl)
  const selected = page.members.slice(0, cli.limit)
  const fetchedAt = new Date().toISOString()

  const cache = new WtCache(config.cachePath)
  const accounts: WtAccount[] = []
  const unresolved: UnresolvedMember[] = []
  let apiCalls = 0

  try {
    cache.upsertClanMembers(config.squadronCode, page.members, fetchedAt)

    for (const member of selected) {
      let wtId: string | null = null

      if (!cli.refresh) {
        const cached = cache.getCachedId(member.username)
        if (cached !== null) {
          wtId = cached.wtId
        }
      }

      if (wtId === null) {
        if (apiCalls > 0 && delayMs > 0) {
          await Bun.sleep(delayMs)
        }
        apiCalls += 1

        try {
          const result = await findExactNickname(member.username, {
            timeoutMs: config.requestTimeoutMs,
            userAgent: config.userAgent,
          })

          if (result.exact !== null) {
            wtId = result.exact.wtId
            cache.setCachedId(member.username, wtId, result.exact.username, new Date().toISOString())
          } else if (result.exactMatches.length > 1) {
            unresolved.push({
              username: member.username,
              reason: 'ambiguous_exact_match',
              candidates: result.exactMatches,
            })
          } else {
            unresolved.push({
              username: member.username,
              reason: 'no_exact_match',
              candidates: result.candidates.slice(0, 10),
            })
          }
        } catch (error) {
          unresolved.push({
            username: member.username,
            reason: 'lookup_failed',
            candidates: [],
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      if (wtId !== null) {
        accounts.push({
          wt_id: wtId,
          username: member.username,
          squadron: config.squadronCode,
          squadron_role: member.squadronRole,
          squadron_joined_at: member.squadronJoinedAt,
        })
      }

      const processed = accounts.length + unresolved.length
      if (processed % 20 === 0 || processed === selected.length) {
        console.log(
          `processed ${processed}/${selected.length} ` +
            `resolved=${accounts.length} unresolved=${unresolved.length}`,
        )
      }
    }

    const output: WtOutput = {
      meta: {
        fetched_at: fetchedAt,
        clan_url: config.clanUrl,
        squadron: config.squadronCode,
        clan_name: page.clanName,
        clan_tag: page.clanTag,
        member_count: page.memberCount,
        processed_count: selected.length,
        resolved_count: accounts.length,
        unresolved_count: unresolved.length,
      },
      accounts,
      unresolved,
    }

    mkdirSync(dirname(outputPath), { recursive: true })
    await Bun.write(outputPath, `${JSON.stringify(output, null, 2)}\n`)

    console.log(`War Thunder accounts written to ${outputPath}`)
    console.log(
      `parsed=${page.members.length} processed=${selected.length} ` +
        `resolved=${accounts.length} unresolved=${unresolved.length} ` +
        `api_calls=${apiCalls}`,
    )
  } finally {
    cache.close()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
