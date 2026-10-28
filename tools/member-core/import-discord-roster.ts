import { resolve } from 'node:path'
import { parseRoster, writeDiscordRosterDatabase } from './discord-roster'
import { defaultMemberDbPath, defaultRosterPath } from './paths'

interface CliOptions {
  input?: string
  db?: string
  help: boolean
}

const HELP = `Usage: bun run import-discord-roster [options]

Import the Discord roster JSON into the member SQLite database.

Options:
  --input <path>   Roster JSON path (default: ../discord-parser/output/discord-members.json)
  --db <path>      SQLite database path (default: output/members.sqlite)
  -h, --help       Show this help
`

function parseCli(argv: string[]): CliOptions {
  const options: CliOptions = { help: false }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    switch (argument) {
      case '--input':
        index += 1
        if (argv[index] === undefined) {
          throw new Error('--input requires a value.')
        }
        options.input = argv[index]
        break
      case '--db':
        index += 1
        if (argv[index] === undefined) {
          throw new Error('--db requires a value.')
        }
        options.db = argv[index]
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

  const inputPath =
    cli.input === undefined ? defaultRosterPath : resolve(process.cwd(), cli.input)
  const dbPath = cli.db === undefined ? defaultMemberDbPath : resolve(process.cwd(), cli.db)

  const inputFile = Bun.file(inputPath)
  if (!(await inputFile.exists())) {
    throw new Error(`Roster JSON not found: ${inputPath}. Run discord-parser harvest-members first.`)
  }

  const raw: unknown = await inputFile.json()
  const roster = parseRoster(raw)
  if (roster.keptCount !== null && roster.keptCount !== roster.members.length) {
    console.warn(
      `Warning: meta.kept_count is ${roster.keptCount}, but the file contains ${roster.members.length} members.`,
    )
  }

  const result = writeDiscordRosterDatabase(dbPath, roster.members)

  console.log(`Member SQLite database written to ${dbPath}`)
  console.log(
    `members=${result.members} accounts=${result.accounts} ` +
      `preserved_ids=${result.preservedIds} new_ids=${result.assignedNewIds} ` +
      `historical=${result.historicalMembers}`,
  )
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
