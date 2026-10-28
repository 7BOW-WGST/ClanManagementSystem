import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { openMemberDatabase } from './db'
import { defaultMemberDbPath, defaultWarthunderLinksPath } from './paths'
import {
  buildWarthunderLinksCsv,
  hasWarthunderLinkData,
  type WarthunderLinkCsvRow,
  type WtOwnership,
} from './warthunder-links'

interface CliOptions {
  output?: string
  db?: string
  force: boolean
  help: boolean
}

const HELP = `Usage: bun run prefill-warthunder-links [options]

Generate input/warthunder-links.csv for unresolved War Thunder accounts.

Options:
  --db <path>      SQLite database path (default: output/members.sqlite)
  --output <path>  CSV path (default: input/warthunder-links.csv)
  --force          Overwrite a CSV that already contains rows
  -h, --help       Show this help
`

function parseCli(argv: string[]): CliOptions {
  const options: CliOptions = { force: false, help: false }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    switch (argument) {
      case '--db':
        index += 1
        if (argv[index] === undefined) {
          throw new Error('--db requires a value.')
        }
        options.db = argv[index]
        break
      case '--output':
        index += 1
        if (argv[index] === undefined) {
          throw new Error('--output requires a value.')
        }
        options.output = argv[index]
        break
      case '--force':
        options.force = true
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

  const dbPath = cli.db === undefined ? defaultMemberDbPath : resolve(process.cwd(), cli.db)
  const outputPath =
    cli.output === undefined
      ? defaultWarthunderLinksPath
      : resolve(process.cwd(), cli.output)

  const outputFile = Bun.file(outputPath)
  if (await outputFile.exists()) {
    const existing = await outputFile.text()
    if (hasWarthunderLinkData(existing) && !cli.force) {
      throw new Error(
        `${outputPath} already contains data. Re-run with --force to overwrite it.`,
      )
    }
  }

  const db = openMemberDatabase(dbPath)
  try {
    const rows = db
      .query<
        {
          wt_id: string
          username: string
          ownership_type: WtOwnership
        },
        []
      >(
        `SELECT wt_id, username, ownership_type
         FROM warthunder_accounts
         WHERE member_id IS NULL
         ORDER BY username COLLATE NOCASE`,
      )
      .all()

    const entries: WarthunderLinkCsvRow[] = rows.map((row) => ({
      wt_id: row.wt_id,
      username: row.username,
      ownership_type: row.ownership_type,
    }))

    mkdirSync(dirname(outputPath), { recursive: true })
    await Bun.write(outputPath, buildWarthunderLinksCsv(entries))

    console.log(`War Thunder link CSV written to ${outputPath}`)
    console.log(`unresolved rows=${entries.length}`)
  } finally {
    db.close()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
