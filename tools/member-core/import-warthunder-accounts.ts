import { resolve } from 'node:path'
import { openMemberDatabase } from './db'
import {
  defaultMemberDbPath,
  defaultWarthunderAccountsPath,
} from './paths'
import { importWarthunderAccounts } from './warthunder-accounts'

interface CliOptions {
  input?: string
  db?: string
  dryRun: boolean
  help: boolean
}

const HELP = `Usage: bun run import-warthunder-accounts [options]

Import War Thunder account projections into the member database.

Options:
  --input <path>   War Thunder account JSON (default: ../warthunder-parser/output/warthunder-accounts.json)
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
    cli.input === undefined
      ? defaultWarthunderAccountsPath
      : resolve(process.cwd(), cli.input)
  const dbPath = cli.db === undefined ? defaultMemberDbPath : resolve(process.cwd(), cli.db)

  const inputFile = Bun.file(inputPath)
  if (!(await inputFile.exists())) {
    throw new Error(
      `War Thunder account JSON not found: ${inputPath}. Run warthunder-parser harvest first.`,
    )
  }

  const raw: unknown = await inputFile.json()
  const db = openMemberDatabase(dbPath)
  try {
    const result = importWarthunderAccounts(db, raw, { dryRun: cli.dryRun })
    console.log(
      `${result.dryRun ? 'Dry run' : 'Import'} complete: ` +
        `processed=${result.processed} inserted=${result.inserted} updated=${result.updated} ` +
        `linked=${result.linked} unlinked=${result.unlinked} ambiguous=${result.ambiguous}`,
    )

    for (const account of result.unlinkedAccounts.slice(0, 20)) {
      console.log(`  unlinked ${account.wt_id} "${account.username}" (${account.reason})`)
    }
    if (result.unlinkedAccounts.length > 20) {
      console.log(`  ... ${result.unlinkedAccounts.length - 20} more unlinked accounts`)
    }
  } finally {
    db.close()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
