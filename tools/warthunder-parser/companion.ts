export interface CompanionCandidate {
  wtId: string
  username: string
}

export interface CompanionSearchResult {
  exact: CompanionCandidate | null
  exactMatches: CompanionCandidate[]
  candidates: CompanionCandidate[]
}

export interface CompanionOptions {
  fetchImpl?: FetchLike
  timeoutMs?: number
  retries?: number
  retryDelayMs?: number
  userAgent?: string
}

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>

const SEARCH_URL = 'https://companion-app.warthunder.com/call/'

function buildSearchUrl(nickname: string): string {
  const url = new URL(SEARCH_URL)
  url.search = new URLSearchParams({
    classname: 'eaw_Contacts',
    method: 'jzx_findUsersByNickPrefix',
    count: '100',
    nick: nickname,
    v: '9',
  }).toString()
  return url.toString()
}

async function sleep(ms: number): Promise<void> {
  await Bun.sleep(ms)
}

export async function findExactNickname(
  nickname: string,
  options: CompanionOptions = {},
): Promise<CompanionSearchResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? 15000
  const retries = options.retries ?? 2
  const retryDelayMs = options.retryDelayMs ?? 500
  const userAgent = options.userAgent ?? 'ClanManagementSystem-WT-Harvester/1.0'

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchImpl(buildSearchUrl(nickname), {
        headers: {
          'User-Agent': userAgent,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(timeoutMs),
      })

      if (response.status === 429 || response.status >= 500) {
        const retryAfter = Number(response.headers.get('retry-after'))
        const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : retryDelayMs * (attempt + 1)
        lastError = new Error(`Companion API returned ${response.status}.`)
        if (attempt < retries) {
          await sleep(waitMs)
          continue
        }
        throw lastError
      }

      if (!response.ok) {
        throw new Error(`Companion API returned ${response.status} ${response.statusText}.`)
      }

      const payload: unknown = await response.json()
      if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
        throw new Error('Companion API returned an unexpected payload.')
      }

      const candidates: CompanionCandidate[] = []
      for (const [wtId, username] of Object.entries(payload)) {
        if (typeof username !== 'string') {
          throw new Error('Companion API returned a non-string nickname.')
        }
        candidates.push({ wtId, username })
      }

      const exactMatches = candidates.filter((candidate) => candidate.username === nickname)

      return {
        exact: exactMatches.length === 1 ? (exactMatches[0] ?? null) : null,
        exactMatches,
        candidates,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      if (attempt >= retries) {
        throw lastError
      }
      await sleep(retryDelayMs * (attempt + 1))
    }
  }

  throw lastError ?? new Error('Companion API lookup failed.')
}
