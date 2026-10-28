import { describe, expect, test } from 'bun:test'
import { openMemberDatabase } from './db'
import {
  buildWarthunderLinksCsv,
  hasWarthunderLinkData,
  importWarthunderLinks,
  parseWarthunderLinksCsv,
} from './warthunder-links'

interface WtRow {
  wt_id: string
  member_id: number | null
  username: string
  ownership_type: string
}

function addMember(
  db: ReturnType<typeof openMemberDatabase>,
  id: number,
  nickname: string,
): void {
  db.run('INSERT INTO members (member_id, nickname, joined_at) VALUES (?, ?, ?)', [
    id,
    nickname,
    '2020-01-01T00:00:00.000Z',
  ])
}

function addAccount(
  db: ReturnType<typeof openMemberDatabase>,
  wtId: string,
  memberId: number | null,
  username: string,
  ownership: 'main' | 'alt' | 'borrowed' = 'main',
): void {
  db.run(
    `INSERT INTO warthunder_accounts (
       wt_id, member_id, username, ownership_type, squadron, squadron_role, squadron_joined_at
     ) VALUES (?, ?, ?, ?, '7BOW', 'Private', '2020-04-28T00:00:00.000Z')`,
    [wtId, memberId, username, ownership],
  )
}

function rows(db: ReturnType<typeof openMemberDatabase>): WtRow[] {
  return db
    .query<WtRow, []>(
      'SELECT wt_id, member_id, username, ownership_type FROM warthunder_accounts ORDER BY wt_id',
    )
    .all()
}

describe('parseWarthunderLinksCsv', () => {
  test('parses optional member and ownership fields', () => {
    const parsed = parseWarthunderLinksCsv(
      'wt_id,username,member_id,ownership_type\n' +
        '101,Alpha,12,alt\n' +
        '102,"LION, JUDAH",,\n',
    )

    expect(parsed).toEqual([
      {
        line: 2,
        wt_id: '101',
        username: 'Alpha',
        member_id: 12,
        ownership_type: 'alt',
      },
      {
        line: 3,
        wt_id: '102',
        username: 'LION, JUDAH',
        member_id: null,
        ownership_type: null,
      },
    ])
  })

  test('rejects duplicate IDs, invalid ownership, and invalid member IDs', () => {
    expect(() =>
      parseWarthunderLinksCsv(
        'wt_id,member_id,ownership_type\n101,1,\n101,2,\n',
      ),
    ).toThrow('duplicate wt_id')
    expect(() =>
      parseWarthunderLinksCsv('wt_id,ownership_type\n101,owner\n'),
    ).toThrow('ownership_type')
    expect(() =>
      parseWarthunderLinksCsv('wt_id,member_id\n101,abc\n'),
    ).toThrow('member_id')
  })
})

describe('buildWarthunderLinksCsv', () => {
  test('writes the expected header and blank member IDs', () => {
    const csv = buildWarthunderLinksCsv([
      { wt_id: '101', username: 'Alpha', ownership_type: 'main' },
      { wt_id: '102', username: 'LION, JUDAH', ownership_type: 'alt' },
    ])

    expect(csv).toBe(
      'wt_id,username,member_id,ownership_type\n' +
        '101,Alpha,,main\n' +
        '102,"LION, JUDAH",,alt\n',
    )
    expect(hasWarthunderLinkData('wt_id,username,member_id,ownership_type\n')).toBe(false)
    expect(hasWarthunderLinkData(csv)).toBe(true)
  })
})

describe('importWarthunderLinks', () => {
  test('applies member links and ownership changes, skipping no-op rows', () => {
    const db = openMemberDatabase(':memory:')
    try {
      addMember(db, 1, 'Alpha')
      addMember(db, 2, 'Beta')
      addMember(db, 3, 'Gamma')
      addAccount(db, '101', null, 'Alpha')
      addAccount(db, '102', null, 'Beta')
      addAccount(db, '103', 3, 'Gamma')

      const result = importWarthunderLinks(
        db,
        'wt_id,username,member_id,ownership_type\n' +
          '101,Alpha,1,\n' +
          '102,Beta,,alt\n' +
          '103,Gamma,3,main\n',
        { dryRun: false },
      )

      expect(result.processed).toBe(3)
      expect(result.updated).toBe(2)
      expect(result.skipped).toBe(1)
      expect(result.warnings).toEqual([
        'Line 3: ownership_type is set but wt_id 102 remains unlinked.',
      ])

      expect(rows(db)).toEqual([
        { wt_id: '101', member_id: 1, username: 'Alpha', ownership_type: 'main' },
        { wt_id: '102', member_id: null, username: 'Beta', ownership_type: 'alt' },
        { wt_id: '103', member_id: 3, username: 'Gamma', ownership_type: 'main' },
      ])
    } finally {
      db.close()
    }
  })

  test('warns about multiple main accounts and username mismatches', () => {
    const db = openMemberDatabase(':memory:')
    try {
      addMember(db, 1, 'Alpha')
      addAccount(db, '101', 1, 'Alpha')
      addAccount(db, '102', 1, 'Beta')

      const result = importWarthunderLinks(
        db,
        'wt_id,username,member_id,ownership_type\n' +
          '102,WrongName,1,main\n',
        { dryRun: true },
      )

      expect(result.updated).toBe(0)
      expect(result.warnings).toContain(
        'Line 2: username "WrongName" does not match stored "Beta".',
      )
      expect(result.warnings).toContain(
        'Member 1 "Alpha" has 2 main War Thunder accounts.',
      )
    } finally {
      db.close()
    }
  })

  test('rejects unknown accounts and members', () => {
    const db = openMemberDatabase(':memory:')
    try {
      addMember(db, 1, 'Alpha')
      addAccount(db, '101', null, 'Alpha')

      expect(() =>
        importWarthunderLinks(db, 'wt_id,member_id\n999,1\n', { dryRun: true }),
      ).toThrow('unknown wt_id')
      expect(() =>
        importWarthunderLinks(db, 'wt_id,member_id\n101,999\n', { dryRun: true }),
      ).toThrow('does not exist')
    } finally {
      db.close()
    }
  })

  test('dry run does not write', () => {
    const db = openMemberDatabase(':memory:')
    try {
      addMember(db, 1, 'Alpha')
      addAccount(db, '101', null, 'Alpha')

      const result = importWarthunderLinks(
        db,
        'wt_id,member_id,ownership_type\n101,1,alt\n',
        { dryRun: true },
      )

      expect(result.updated).toBe(1)
      expect(rows(db)[0]).toEqual({
        wt_id: '101',
        member_id: null,
        username: 'Alpha',
        ownership_type: 'main',
      })
    } finally {
      db.close()
    }
  })
})
