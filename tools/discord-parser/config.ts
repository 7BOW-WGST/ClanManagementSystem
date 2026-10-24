import { isAbsolute, resolve } from 'node:path'
import type { HarvestConfig } from './types'

// Resolve paths and the local .env relative to this tool, not the process CWD.
export const toolDir = import.meta.dir

function parseEnv(text: string): Map<string, string> {
  const values = new Map<string, string>()

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue
    }

    const withoutExport = trimmed.startsWith('export ') ? trimmed.slice(7).trim() : trimmed
    const separator = withoutExport.indexOf('=')
    if (separator <= 0) {
      continue
    }

    const key = withoutExport.slice(0, separator).trim()
    let value = withoutExport.slice(separator + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    values.set(key, value)
  }

  return values
}

async function loadLocalEnv(): Promise<void> {
  const envFile = Bun.file(resolve(toolDir, '.env'))
  if (!(await envFile.exists())) {
    return
  }

  const values = parseEnv(await envFile.text())
  for (const [key, value] of values) {
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = value
    }
  }
}

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (value === undefined || value === '') {
    throw new Error(`${name} is not set. Copy .env.example to .env and fill it in.`)
  }
  return value
}

function snowflake(name: string, value: string): string {
  if (!/^\d{17,20}$/.test(value)) {
    throw new Error(`${name} must be a Discord snowflake (17-20 digits).`)
  }
  return value
}

function integerInRange(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim()
  if (raw === undefined || raw === '') {
    return fallback
  }

  const value = Number(raw)
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max} (got "${raw}").`)
  }
  return value
}

function localPath(value: string | undefined, fallback: string): string {
  const raw = value?.trim()
  const path = raw === undefined || raw === '' ? fallback : raw
  return isAbsolute(path) ? path : resolve(toolDir, path)
}

// Load and validate the harvester configuration. The token is never echoed in errors.
export async function loadConfig(): Promise<HarvestConfig> {
  await loadLocalEnv()

  return {
    botToken: required('DISCORD_BOT_TOKEN'),
    guildId: snowflake('DISCORD_GUILD_ID', required('DISCORD_GUILD_ID')),
    apiVersion: integerInRange('DISCORD_API_VERSION', 10, 9, 10),
    pageSize: integerInRange('DISCORD_MEMBER_PAGE_SIZE', 1000, 1, 1000),
    cachePath: localPath(process.env.DISCORD_CACHE_PATH, './cache/discord.sqlite'),
    outputPath: localPath(process.env.DISCORD_MEMBERS_OUTPUT, './output/discord-members.json'),
  }
}
