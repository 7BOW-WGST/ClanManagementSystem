import { isAbsolute, resolve } from 'node:path'

export interface WtConfig {
  clanUrl: string
  squadronCode: '7BOW' | '7BOWs' | '7BOWr'
  searchDelayMs: number
  requestTimeoutMs: number
  cachePath: string
  outputPath: string
  userAgent: string
}

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

function resolveClanUrl(value: string | undefined): string {
  const raw = value?.trim() || 'https://warthunder.com/en/community/claninfo/7%20Brygada%20Obrony%20Wybrzeza'
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('WT_CLAN_URL must be a valid URL.')
  }
  if (url.protocol !== 'https:') {
    throw new Error('WT_CLAN_URL must use https.')
  }
  return raw
}

function resolveSquadronCode(value: string | undefined): WtConfig['squadronCode'] {
  const raw = value?.trim() || '7BOW'
  if (raw === '7BOW' || raw === '7BOWs' || raw === '7BOWr') {
    return raw
  }
  throw new Error('WT_SQUADRON_CODE must be one of 7BOW, 7BOWs, 7BOWr.')
}

export async function loadConfig(): Promise<WtConfig> {
  await loadLocalEnv()

  return {
    clanUrl: resolveClanUrl(process.env.WT_CLAN_URL),
    squadronCode: resolveSquadronCode(process.env.WT_SQUADRON_CODE),
    searchDelayMs: integerInRange('WT_SEARCH_DELAY_MS', 350, 0, 10000),
    requestTimeoutMs: integerInRange('WT_REQUEST_TIMEOUT_MS', 15000, 1000, 60000),
    cachePath: localPath(process.env.WT_CACHE_PATH, './cache/warthunder.sqlite'),
    outputPath: localPath(process.env.WT_OUTPUT_PATH, './output/warthunder-accounts.json'),
    userAgent: process.env.WT_USER_AGENT?.trim() || 'ClanManagementSystem-WT-Harvester/1.0',
  }
}
