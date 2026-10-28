import { describe, expect, test } from 'bun:test'
import { WtCache } from './cache'

describe('WtCache', () => {
  test('stores and updates nickname IDs', () => {
    const cache = new WtCache(':memory:')
    try {
      expect(cache.getCachedId('WOJTEK885')).toBeNull()
      cache.setCachedId('WOJTEK885', '35784730', 'WOJTEK885', '2026-01-01T00:00:00.000Z')
      expect(cache.getCachedId('WOJTEK885')).toEqual({
        wtId: '35784730',
        matchedUsername: 'WOJTEK885',
      })

      cache.setCachedId('WOJTEK885', '35784731', 'WOJTEK885', '2026-01-02T00:00:00.000Z')
      expect(cache.getCachedId('WOJTEK885')?.wtId).toBe('35784731')
    } finally {
      cache.close()
    }
  })

  test('upserts clan member snapshots', () => {
    const cache = new WtCache(':memory:')
    try {
      cache.upsertClanMembers(
        '7BOW',
        [
          {
            username: 'WOJTEK885',
            squadronRole: 'Commander',
            squadronJoinedAt: '2020-04-28T00:00:00.000Z',
            personalClanRating: 1384,
            activity: 1163,
          },
        ],
        '2026-01-01T00:00:00.000Z',
      )
      cache.upsertClanMembers(
        '7BOW',
        [
          {
            username: 'WOJTEK885',
            squadronRole: 'Officer',
            squadronJoinedAt: '2020-04-28T00:00:00.000Z',
            personalClanRating: 1400,
            activity: 1200,
          },
        ],
        '2026-01-02T00:00:00.000Z',
      )

      const row = cache.getClanMember('7BOW', 'WOJTEK885')
      expect(row).toEqual({
        username: 'WOJTEK885',
        squadronRole: 'Officer',
        squadronJoinedAt: '2020-04-28T00:00:00.000Z',
        personalClanRating: 1400,
        activity: 1200,
        fetchedAt: '2026-01-02T00:00:00.000Z',
      })
    } finally {
      cache.close()
    }
  })
})
