import { resolve } from 'node:path'
import { openMemberDatabase } from './db'
import { defaultMemberDbPath, defaultWarthunderLinksPath } from './paths'
import { importWarthunderLinks } from './warthunder-links'

interface CliOptions {
  input?: string
  db?: string
  dryRun: boolean
  help: boolean
}

const HELP = `Usage: bun run import-warthunder-links [options]

Apply manual member links and ownership changes for War Thunder accounts.

Options:
  --input <path>   CSV path (default: input/warthunder-links.csv)
  --db <path>      SQLite database path (default: output/members.sqlite)
  --dry-run        Validate and report without writing
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
    cli.input === undefined
      ? defaultWarthunderLinksPath
      : resolve(process.cwd(), cli.input)
  const dbPath = cli.db === undefined ? defaultMemberDbPath : resolve(process.cwd(), cli.db)

  const inputFile = Bun.file(inputPath)
  if (!(await inputFile.exists())) {
    throw new Error(
      `War Thunder link CSV not found: ${inputPath}. Run prefill-warthunder-links first.`,
    )
  }

  const text = await inputFile.text()
  const db = openMemberDatabase(dbPath)
  try {
    const result = importWarthunderLinks(db, text, { dryRun: cli.dryRun })
    console.log(
      `${result.dryRun ? 'Dry run' : 'Import'} complete: ` +
        `processed=${result.processed} updated=${result.updated} skipped=${result.skipped}`,
    )
    for (const warning of result.warnings) {
      console.warn(`  warning: ${warning}`)
    }
  } finally {
    db.close()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
