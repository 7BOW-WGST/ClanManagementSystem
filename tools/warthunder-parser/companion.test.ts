import { describe, expect, test } from 'bun:test'
import { findExactNickname, type FetchLike } from './companion'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function fetchReturning(body: unknown): FetchLike {
  return async () => jsonResponse(body)
}

describe('findExactNickname', () => {
  test('returns the exact case-sensitive match', async () => {
    const result = await findExactNickname('WOJTEK885', {
      fetchImpl: fetchReturning({
        '35784730': 'WOJTEK885',
        '108771192': 'Wojtek8857',
      }),
    })

    expect(result.exact).toEqual({ wtId: '35784730', username: 'WOJTEK885' })
    expect(result.exactMatches).toHaveLength(1)
    expect(result.candidates).toHaveLength(2)
  })

  test('does not accept a case-insensitive-only match', async () => {
    const result = await findExactNickname('WOJTEK885', {
      fetchImpl: fetchReturning({ '108771192': 'Wojtek8857' }),
    })

    expect(result.exact).toBeNull()
    expect(result.exactMatches).toHaveLength(0)
    expect(result.candidates).toEqual([
      { wtId: '108771192', username: 'Wojtek8857' },
    ])
  })

  test('reports ambiguous exact matches', async () => {
    const result = await findExactNickname('Same', {
      fetchImpl: fetchReturning({ '1': 'Same', '2': 'Same' }),
    })

    expect(result.exact).toBeNull()
    expect(result.exactMatches).toHaveLength(2)
  })

  test('includes the nickname in the request query', async () => {
    let requestedUrl = ''
    await findExactNickname('LION OF JUDAH', {
      fetchImpl: async (input) => {
        requestedUrl = input instanceof Request ? input.url : String(input)
        return jsonResponse({})
      },
    })

    expect(requestedUrl).toContain('nick=LION+OF+JUDAH')
    expect(requestedUrl).toContain('classname=eaw_Contacts')
    expect(requestedUrl).toContain('method=jzx_findUsersByNickPrefix')
  })

  test('retries transient server errors', async () => {
    let calls = 0
    const result = await findExactNickname('Player', {
      retries: 1,
      retryDelayMs: 0,
      fetchImpl: async () => {
        calls += 1
        if (calls === 1) {
          return jsonResponse({ error: 'temporary' }, 500)
        }
        return jsonResponse({ '42': 'Player' })
      },
    })

    expect(calls).toBe(2)
    expect(result.exact?.wtId).toBe('42')
  })

  test('fails on malformed payloads', async () => {
    await expect(
      findExactNickname('Player', {
        retries: 0,
        fetchImpl: fetchReturning(['not', 'an', 'object']),
      }),
    ).rejects.toThrow('unexpected payload')
  })
})
