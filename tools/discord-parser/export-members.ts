import { resolve } from 'node:path'
import { toolDir } from './config'
import { parseRoster, writeMemberDatabase } from './member-db'

interface CliOptions {
  input?: string
  output?: string
  help: boolean
}

const HELP = `Usage: bun run export-members [options]

Export the harvested roster into the SQLite member database.

Options:
  --input <path>    Roster JSON path (default: output/discord-members.json)
  --output <path>   SQLite database path (default: output/members.sqlite)
  -h, --help        Show this help
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

  const inputPath =
    cli.input === undefined
      ? resolve(toolDir, './output/discord-members.json')
      : resolve(process.cwd(), cli.input)
  const outputPath =
    cli.output === undefined
      ? resolve(toolDir, './output/members.sqlite')
      : resolve(process.cwd(), cli.output)

  const inputFile = Bun.file(inputPath)
  if (!(await inputFile.exists())) {
    throw new Error(`Roster JSON not found: ${inputPath}. Run harvest-members first.`)
  }

  const raw: unknown = await inputFile.json()
  const roster = parseRoster(raw)
  if (roster.keptCount !== null && roster.keptCount !== roster.members.length) {
    console.warn(
      `Warning: meta.kept_count is ${roster.keptCount}, but the file contains ${roster.members.length} members.`,
    )
  }

  const result = writeMemberDatabase(outputPath, roster.members)

  console.log(`SQLite database written to ${outputPath}`)
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
