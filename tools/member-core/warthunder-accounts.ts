import type { Database } from 'bun:sqlite'
import { toIsoTimestamp } from './db'

export type WtSquadron = '7BOW' | '7BOWs' | '7BOWr'

export interface WtAccountInput {
  wt_id: string
  username: string
  squadron: WtSquadron | null
  squadron_role: string | null
  squadron_joined_at: string | null
}

export interface WtUnlinkedAccount {
  wt_id: string
  username: string
  reason: 'no_match' | 'ambiguous'
}

export interface WtImportResult {
  processed: number
  inserted: number
  updated: number
  linked: number
  unlinked: number
  ambiguous: number
  dryRun: boolean
  unlinkedAccounts: WtUnlinkedAccount[]
}

interface NameMaps {
  exact: Map<string, Set<number>>
  normalized: Map<string, Set<number>>
}

interface MatchResult {
  memberId: number | null
  reason: 'matched' | 'no_match' | 'ambiguous'
}

interface ExistingAccount {
  wtId: string
  memberId: number | null
}

interface ImportRow {
  account: WtAccountInput
  memberId: number | null
}

const VALID_SQUADRONS: WtSquadron[] = ['7BOW', '7BOWs', '7BOWr']

const UPSERT_WARTHUNDER_ACCOUNT = `
  INSERT INTO warthunder_accounts (
    wt_id, member_id, username, ownership_type, squadron, squadron_role, squadron_joined_at
  ) VALUES (?, ?, ?, 'main', ?, ?, ?)
  ON CONFLICT (wt_id) DO UPDATE SET
    username = excluded.username,
    squadron = excluded.squadron,
    squadron_role = excluded.squadron_role,
    squadron_joined_at = excluded.squadron_joined_at,
    member_id = COALESCE(warthunder_accounts.member_id, excluded.member_id)
`

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${field} must be a non-empty string.`)
  }
  return value
}

function optionalString(value: unknown, field: string): string | null {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string or null.`)
  }
  return value === '' ? null : value
}

function parseSquadron(value: unknown, field: string): WtSquadron | null {
  const squadron = optionalString(value, field)
  if (squadron === null) {
    return null
  }
  if (!VALID_SQUADRONS.includes(squadron as WtSquadron)) {
    throw new Error(`${field} must be one of ${VALID_SQUADRONS.join(', ')}.`)
  }
  return squadron as WtSquadron
}

export function parseWarthunderAccounts(value: unknown): WtAccountInput[] {
  if (!isRecord(value)) {
    throw new Error('War Thunder JSON must be an object.')
  }

  const rawAccounts = value.accounts
  if (!Array.isArray(rawAccounts)) {
    throw new Error('War Thunder JSON must contain an accounts array.')
  }

  const accounts = rawAccounts.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`accounts[${index}] must be an object.`)
    }

    const wtId = requiredString(entry.wt_id, `accounts[${index}].wt_id`)
    if (!/^\d+$/.test(wtId)) {
      throw new Error(`accounts[${index}].wt_id must be a numeric string.`)
    }

    return {
      wt_id: wtId,
      username: requiredString(entry.username, `accounts[${index}].username`),
      squadron: parseSquadron(entry.squadron, `accounts[${index}].squadron`),
      squadron_role: optionalString(
        entry.squadron_role,
        `accounts[${index}].squadron_role`,
      ),
      squadron_joined_at: toIsoTimestamp(
        optionalString(entry.squadron_joined_at, `accounts[${index}].squadron_joined_at`),
        `accounts[${index}].squadron_joined_at`,
      ),
    }
  })

  const seen = new Set<string>()
  for (const account of accounts) {
    if (seen.has(account.wt_id)) {
      throw new Error(`Duplicate wt_id in War Thunder JSON: ${account.wt_id}`)
    }
    seen.add(account.wt_id)
  }

  return accounts
}

function normalizeName(value: string): string {
  return value.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('pl')
}

function addName(maps: NameMaps, name: string | null, memberId: number): void {
  if (name === null || name.trim() === '') {
    return
  }

  const exact = maps.exact.get(name) ?? new Set<number>()
  exact.add(memberId)
  maps.exact.set(name, exact)

  const normalized = normalizeName(name)
  const loose = maps.normalized.get(normalized) ?? new Set<number>()
  loose.add(memberId)
  maps.normalized.set(normalized, loose)
}

function loadNameMaps(db: Database): NameMaps {
  const maps: NameMaps = {
    exact: new Map(),
    normalized: new Map(),
  }

  const members = db
    .query<{ member_id: number; nickname: string }, []>(
      'SELECT member_id, nickname FROM members',
    )
    .all()
  for (const member of members) {
    addName(maps, member.nickname, member.member_id)
  }

  const discordAccounts = db
    .query<
      {
        member_id: number
        username: string
        global_name: string | null
        server_name: string | null
      },
      []
    >(
      `SELECT member_id, username, global_name, server_name
       FROM discord_accounts`,
    )
    .all()
  for (const account of discordAccounts) {
    addName(maps, account.username, account.member_id)
    addName(maps, account.global_name, account.member_id)
    addName(maps, account.server_name, account.member_id)
  }

  return maps
}

function onlyMember(members: Set<number> | undefined): number | null {
  if (members === undefined || members.size !== 1) {
    return null
  }
  for (const memberId of members) {
    return memberId
  }
  return null
}

function matchMember(username: string, maps: NameMaps): MatchResult {
  const exact = maps.exact.get(username)
  if (exact !== undefined) {
    const memberId = onlyMember(exact)
    return memberId === null
      ? { memberId: null, reason: 'ambiguous' }
      : { memberId, reason: 'matched' }
  }

  const normalized = maps.normalized.get(normalizeName(username))
  if (normalized !== undefined) {
    const memberId = onlyMember(normalized)
    return memberId === null
      ? { memberId: null, reason: 'ambiguous' }
      : { memberId, reason: 'matched' }
  }

  return { memberId: null, reason: 'no_match' }
}

function loadExistingAccounts(db: Database): Map<string, ExistingAccount> {
  const rows = db
    .query<{ wt_id: string; member_id: number | null }, []>(
      'SELECT wt_id, member_id FROM warthunder_accounts',
    )
    .all()
  const existing = new Map<string, ExistingAccount>()
  for (const row of rows) {
    existing.set(row.wt_id, { wtId: row.wt_id, memberId: row.member_id })
  }
  return existing
}

export function importWarthunderAccounts(
  db: Database,
  value: unknown,
  options: { dryRun: boolean },
): WtImportResult {
  const accounts = parseWarthunderAccounts(value)
  const maps = loadNameMaps(db)
  const existing = loadExistingAccounts(db)
  const rows: ImportRow[] = []

  let inserted = 0
  let updated = 0
  let linked = 0
  let ambiguous = 0
  const unlinkedAccounts: WtUnlinkedAccount[] = []

  for (const account of accounts) {
    const current = existing.get(account.wt_id)
    if (current === undefined) {
      inserted += 1
    } else {
      updated += 1
    }

    const match = matchMember(account.username, maps)
    const memberId = current?.memberId ?? match.memberId

    if (memberId === null) {
      if (match.reason === 'ambiguous') {
        ambiguous += 1
        unlinkedAccounts.push({
          wt_id: account.wt_id,
          username: account.username,
          reason: 'ambiguous',
        })
      } else {
        unlinkedAccounts.push({
          wt_id: account.wt_id,
          username: account.username,
          reason: 'no_match',
        })
      }
    } else {
      linked += 1
    }

    rows.push({ account, memberId })
  }

  if (!options.dryRun && rows.length > 0) {
    const write = db.transaction(() => {
      for (const row of rows) {
        db.run(UPSERT_WARTHUNDER_ACCOUNT, [
          row.account.wt_id,
          row.memberId,
          row.account.username,
          row.account.squadron,
          row.account.squadron_role,
          row.account.squadron_joined_at,
        ])
      }
    })
    write()
  }

  return {
    processed: accounts.length,
    inserted,
    updated,
    linked,
    unlinked: unlinkedAccounts.length,
    ambiguous,
    dryRun: options.dryRun,
    unlinkedAccounts,
  }
}
