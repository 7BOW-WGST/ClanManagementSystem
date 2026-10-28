import { resolve } from 'node:path'
import { openMemberDatabase } from './db'
import { importNicknameCsv } from './nicknames'
import { defaultMemberDbPath, defaultNicknameCsvPath } from './paths'

interface CliOptions {
  input?: string
  db?: string
  dryRun: boolean
  help: boolean
}

const HELP = `Usage: bun run import-nicknames [options]

Import manual nickname events from a CSV file.

CSV header:
  discord_id,nickname

Options:
  --input <path>   CSV path (default: input/nicknames.csv)
  --db <path>      SQLite database path (default: output/members.sqlite)
  --dry-run        Validate and count without writing
  -h, --help       Show this help
`

function parseCli(argv: string[]): CliOptions {
  const options: CliOptions = { dryRun: false, help: false }

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
      case '--dry-run':
        options.dryRun = true
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
    cli.input === undefined ? defaultNicknameCsvPath : resolve(process.cwd(), cli.input)
  const dbPath = cli.db === undefined ? defaultMemberDbPath : resolve(process.cwd(), cli.db)

  const inputFile = Bun.file(inputPath)
  if (!(await inputFile.exists())) {
    throw new Error(
      `Nickname CSV not found: ${inputPath}. Copy input/nicknames.csv.example to input/nicknames.csv.`,
    )
  }

  const text = await inputFile.text()
  const db = openMemberDatabase(dbPath)
  try {
    const result = importNicknameCsv(db, text, { dryRun: cli.dryRun })
    console.log(
      `${result.dryRun ? 'Dry run' : 'Import'} complete: ` +
        `processed=${result.processed} inserted=${result.inserted} skipped=${result.skipped}`,
    )
  } finally {
    db.close()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
