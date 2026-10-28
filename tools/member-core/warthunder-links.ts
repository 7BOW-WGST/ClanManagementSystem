import type { Database } from 'bun:sqlite'
import { escapeCsvField, parseCsv } from './csv'

export type WtOwnership = 'main' | 'alt' | 'borrowed'

export interface WarthunderLinkRow {
  line: number
  wt_id: string
  username: string | null
  member_id: number | null
  ownership_type: WtOwnership | null
}

export interface WarthunderLinkCsvRow {
  wt_id: string
  username: string | null
  ownership_type: WtOwnership | null
}

export interface LinkImportResult {
  processed: number
  updated: number
  skipped: number
  warnings: string[]
  dryRun: boolean
}

interface ExistingAccount {
  wt_id: string
  username: string
  member_id: number | null
  ownership_type: WtOwnership
}

const VALID_OWNERSHIP: WtOwnership[] = ['main', 'alt', 'borrowed']

function parseOwnership(value: string, line: number): WtOwnership | null {
  const cleaned = value.trim().toLowerCase()
  if (cleaned === '') {
    return null
  }
  if (!VALID_OWNERSHIP.includes(cleaned as WtOwnership)) {
    throw new Error(`Line ${line}: ownership_type must be main, alt, or borrowed.`)
  }
  return cleaned as WtOwnership
}

export function parseWarthunderLinksCsv(text: string): WarthunderLinkRow[] {
  const rows = parseCsv(text).filter((row) => row.values.some((entry) => entry.trim() !== ''))
  const header = rows[0]
  if (header === undefined) {
    return []
  }

  const columns = new Map<string, number>()
  header.values.forEach((name, index) => {
    columns.set(name.trim().toLowerCase(), index)
  })

  for (const required of ['wt_id']) {
    if (!columns.has(required)) {
      throw new Error(`CSV is missing the required "${required}" column.`)
    }
  }
  if (!columns.has('member_id') && !columns.has('ownership_type')) {
    throw new Error('CSV must contain a member_id or ownership_type column.')
  }

  const result: WarthunderLinkRow[] = []
  const seen = new Set<string>()

  for (const row of rows.slice(1)) {
    const get = (name: string): string => {
      const index = columns.get(name)
      if (index === undefined) {
        return ''
      }
      return (row.values[index] ?? '').trim()
    }

    const wtId = get('wt_id')
    if (wtId === '') {
      throw new Error(`Line ${row.line}: wt_id is required.`)
    }
    if (!/^\d+$/.test(wtId)) {
      throw new Error(`Line ${row.line}: wt_id must be numeric.`)
    }
    if (seen.has(wtId)) {
      throw new Error(`Line ${row.line}: duplicate wt_id ${wtId}.`)
    }
    seen.add(wtId)

    const usernameRaw = get('username')
    const memberRaw = get('member_id')
    const ownershipRaw = get('ownership_type')

    let memberId: number | null = null
    if (memberRaw !== '') {
      if (!/^\d+$/.test(memberRaw)) {
        throw new Error(`Line ${row.line}: member_id must be numeric.`)
      }
      memberId = Number(memberRaw)
      if (memberId < 1) {
        throw new Error(`Line ${row.line}: member_id must be positive.`)
      }
    }

    result.push({
      line: row.line,
      wt_id: wtId,
      username: usernameRaw === '' ? null : usernameRaw,
      member_id: memberId,
      ownership_type: parseOwnership(ownershipRaw, row.line),
    })
  }

  return result
}

export function buildWarthunderLinksCsv(rows: WarthunderLinkCsvRow[]): string {
  const lines = ['wt_id,username,member_id,ownership_type']
  for (const row of rows) {
    lines.push(
      [
        escapeCsvField(row.wt_id),
        escapeCsvField(row.username ?? ''),
        '',
        escapeCsvField(row.ownership_type ?? ''),
      ].join(','),
    )
  }
  return `${lines.join('\n')}\n`
}

export function hasWarthunderLinkData(text: string): boolean {
  if (text.trim() === '') {
    return false
  }
  try {
    return parseWarthunderLinksCsv(text).length > 0
  } catch {
    return true
  }
}

function loadExistingAccounts(db: Database): Map<string, ExistingAccount> {
  const rows = db
    .query<
      {
        wt_id: string
        username: string
        member_id: number | null
        ownership_type: WtOwnership
      },
      []
    >('SELECT wt_id, username, member_id, ownership_type FROM warthunder_accounts')
    .all()

  const existing = new Map<string, ExistingAccount>()
  for (const row of rows) {
    existing.set(row.wt_id, row)
  }
  return existing
}

function loadMemberNicknames(db: Database): Map<number, string> {
  const rows = db
    .query<{ member_id: number; nickname: string }, []>(
      'SELECT member_id, nickname FROM members',
    )
    .all()
  return new Map(rows.map((row) => [row.member_id, row.nickname]))
}

function memberExists(db: Database, memberId: number): boolean {
  const row = db
    .query<{ found: number }, [number]>(
      'SELECT 1 AS found FROM members WHERE member_id = ?',
    )
    .get(memberId)
  return row !== null
}

export function importWarthunderLinks(
  db: Database,
  text: string,
  options: { dryRun: boolean },
): LinkImportResult {
  const rows = parseWarthunderLinksCsv(text)
  const existing = loadExistingAccounts(db)
  const nicknames = loadMemberNicknames(db)
  const warnings: string[] = []
  const updates: Array<{
    wt_id: string
    member_id: number | null
    ownership_type: WtOwnership | null
    proposedMemberId: number | null
    proposedOwnership: WtOwnership
  }> = []

  let skipped = 0

  for (const row of rows) {
    const account = existing.get(row.wt_id)
    if (account === undefined) {
      throw new Error(`Line ${row.line}: unknown wt_id ${row.wt_id}.`)
    }

    if (row.username !== null && row.username !== account.username) {
      warnings.push(
        `Line ${row.line}: username "${row.username}" does not match stored "${account.username}".`,
      )
    }

    if (row.member_id !== null && !memberExists(db, row.member_id)) {
      throw new Error(`Line ${row.line}: member_id ${row.member_id} does not exist.`)
    }

    const proposedMemberId = row.member_id ?? account.member_id
    const proposedOwnership = row.ownership_type ?? account.ownership_type

    if (
      proposedMemberId === account.member_id &&
      proposedOwnership === account.ownership_type
    ) {
      skipped += 1
      continue
    }

    if (proposedOwnership !== null && proposedMemberId === null) {
      warnings.push(
        `Line ${row.line}: ownership_type is set but wt_id ${row.wt_id} remains unlinked.`,
      )
    }

    updates.push({
      wt_id: row.wt_id,
      member_id: row.member_id,
      ownership_type: row.ownership_type,
      proposedMemberId,
      proposedOwnership,
    })
  }

  const mainCounts = new Map<number, number>()
  for (const account of existing.values()) {
    if (account.ownership_type === 'main' && account.member_id !== null) {
      mainCounts.set(account.member_id, (mainCounts.get(account.member_id) ?? 0) + 1)
    }
  }
  for (const update of updates) {
    const account = existing.get(update.wt_id)
    if (account === undefined) {
      continue
    }
    if (account.ownership_type === 'main' && account.member_id !== null) {
      mainCounts.set(
        account.member_id,
        (mainCounts.get(account.member_id) ?? 1) - 1,
      )
    }
    if (update.proposedOwnership === 'main' && update.proposedMemberId !== null) {
      mainCounts.set(
        update.proposedMemberId,
        (mainCounts.get(update.proposedMemberId) ?? 0) + 1,
      )
    }
  }
  for (const [memberId, count] of mainCounts) {
    if (count > 1) {
      const nickname = nicknames.get(memberId)
      warnings.push(
        `Member ${memberId}${nickname === undefined ? '' : ` "${nickname}"`} has ${count} main War Thunder accounts.`,
      )
    }
  }

  if (!options.dryRun && updates.length > 0) {
    const write = db.transaction(() => {
      for (const update of updates) {
        db.run(
          `UPDATE warthunder_accounts
           SET member_id = COALESCE(?, member_id),
               ownership_type = COALESCE(?, ownership_type)
           WHERE wt_id = ?`,
          [update.member_id, update.ownership_type, update.wt_id],
        )
      }
    })
    write()
  }

  return {
    processed: rows.length,
    updated: updates.length,
    skipped,
    warnings,
    dryRun: options.dryRun,
  }
}
