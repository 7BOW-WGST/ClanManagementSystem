import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { discordPlaceholderNickname, parseRoster } from './discord-roster'
import { buildNicknameCsv, hasNicknameData } from './nicknames'
import { defaultNicknameCsvPath, defaultRosterPath } from './paths'

interface CliOptions {
  input?: string
  output?: string
  force: boolean
  help: boolean
}

const HELP = `Usage: bun run prefill-nicknames [options]

Generate input/nicknames.csv from the current Discord roster JSON.

Options:
  --input <path>    Roster JSON path (default: ../discord-parser/output/discord-members.json)
  --output <path>   CSV path (default: input/nicknames.csv)
  --force           Overwrite a CSV that already contains nickname rows
  -h, --help        Show this help
`

function parseCli(argv: string[]): CliOptions {
  const options: CliOptions = { force: false, help: false }

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

  const inputPath =
    cli.input === undefined ? defaultRosterPath : resolve(process.cwd(), cli.input)
  const outputPath =
    cli.output === undefined ? defaultNicknameCsvPath : resolve(process.cwd(), cli.output)

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

  const outputFile = Bun.file(outputPath)
  if (await outputFile.exists()) {
    const existing = await outputFile.text()
    if (hasNicknameData(existing) && !cli.force) {
      throw new Error(
        `${outputPath} already contains nickname rows. Re-run with --force to overwrite it.`,
      )
    }
  }

  mkdirSync(dirname(outputPath), { recursive: true })
  const csv = buildNicknameCsv(
    roster.members.map((member) => ({
      discord_id: member.discord_id,
      nickname: discordPlaceholderNickname(member),
    })),
  )
  await Bun.write(outputPath, csv)

  console.log(`Nickname CSV written to ${outputPath}`)
  console.log(`rows=${roster.members.length}`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
