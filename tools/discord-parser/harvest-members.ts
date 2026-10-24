import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { RosterCache } from './cache'
import { loadConfig } from './config'
import { DiscordSource } from './discord'
import { buildRosterOutput, filterRoster, matchingRoleIds, toGuildMemberRecord } from './roster'

interface CliOptions {
  includeBots: boolean
  includePending: boolean
  limit?: number
  output?: string
  help: boolean
}

const HELP = `Usage: bun run harvest-members [options]

Fetch the current Discord guild roster and write a player-base JSON file.

Options:
  --include-bots       Include bot accounts (excluded by default)
  --include-pending    Include members pending screening (excluded by default)
  --limit <n>          Fetch at most n members (smoke testing)
  --output <path>      Override the output JSON path
  -h, --help           Show this help
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

function parseCli(argv: string[]): CliOptions {
  const options: CliOptions = {
    includeBots: false,
    includePending: false,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    switch (argument) {
      case '--include-bots':
        options.includeBots = true
        break
      case '--include-pending':
        options.includePending = true
        break
      case '--limit':
        index += 1
        options.limit = positiveInteger(argv[index], '--limit')
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

function hasStatus(value: unknown): value is { status: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    typeof value.status === 'number'
  )
}

function formatError(error: unknown): string {
  if (hasStatus(error)) {
    if (error.status === 401) {
      return 'Discord rejected the bot token (401). Check DISCORD_BOT_TOKEN.'
    }
    if (error.status === 403) {
      return [
        'Discord returned 403 (Forbidden).',
        'Ensure the bot is in the guild, has View Channels, and that the',
        'Server Members privileged intent is enabled in the Developer Portal.',
      ].join(' ')
    }
    if (error.status === 404) {
      return 'Discord returned 404. Check DISCORD_GUILD_ID and the bot guild membership.'
    }

    const message = error instanceof Error ? error.message : 'Discord request failed.'
    return `Discord request failed (${error.status}): ${message}`
  }

  if (error instanceof Error) {
    return error.message
  }
  return String(error)
}

async function main(): Promise<void> {
  const cli = parseCli(Bun.argv.slice(2))
  if (cli.help) {
    console.log(HELP)
    return
  }

  const config = await loadConfig()
  const outputPath = cli.output === undefined ? config.outputPath : resolve(process.cwd(), cli.output)
  mkdirSync(dirname(outputPath), { recursive: true })

  const cache = new RosterCache(config.cachePath)
  try {
    const source = new DiscordSource({
      token: config.botToken,
      apiVersion: config.apiVersion,
      pageSize: config.pageSize,
    })

    const [guild, botUser] = await Promise.all([
      source.fetchGuild(config.guildId),
      source.fetchCurrentUser(),
    ])

    const guildRoleIds = new Set(guild.roles.map((role) => role.id))
    const missingRoleIds = config.memberRoleIds.filter((roleId) => !guildRoleIds.has(roleId))
    if (missingRoleIds.length > 0) {
      console.warn(`Warning: configured role IDs not found in guild: ${missingRoleIds.join(', ')}`)
    }

    const allMembers = await source.fetchGuildMembers(config.guildId, { limit: cli.limit })
    const fetchedAt = new Date().toISOString()

    const filtered = filterRoster(allMembers, {
      includeBots: cli.includeBots,
      includePending: cli.includePending,
      memberRoleIds: config.memberRoleIds,
    })
    const records = filtered.members.map((member) =>
      toGuildMemberRecord(
        member,
        fetchedAt,
        matchingRoleIds(member, config.memberRoleIds),
      ),
    )

    cache.upsertMembers(config.guildId, records)
    cache.recordRun({
      guildId: config.guildId,
      fetchedAt,
      fetchedCount: filtered.fetchedCount,
      keptCount: filtered.keptCount,
      botCount: filtered.botCount,
      pendingCount: filtered.pendingCount,
      roleFilteredCount: filtered.roleFilteredCount,
    })

    const output = buildRosterOutput({
      guild,
      botUser,
      fetchedAt,
      fetchedCount: filtered.fetchedCount,
      keptCount: filtered.keptCount,
      botCount: filtered.botCount,
      pendingCount: filtered.pendingCount,
      roleFilteredCount: filtered.roleFilteredCount,
      requiredRoleIds: config.memberRoleIds,
      members: records,
    })

    await Bun.write(outputPath, `${JSON.stringify(output, null, 2)}\n`)

    console.log(`Roster written to ${outputPath}`)
    console.log(
      `fetched=${filtered.fetchedCount} kept=${filtered.keptCount} ` +
        `bots=${filtered.botCount} pending=${filtered.pendingCount} ` +
        `role_filtered=${filtered.roleFilteredCount}`,
    )
  } finally {
    cache.close()
  }
}

main().catch((error: unknown) => {
  console.error(formatError(error))
  process.exitCode = 1
})
