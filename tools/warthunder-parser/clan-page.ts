export interface ClanMember {
  username: string
  squadronRole: string | null
  squadronJoinedAt: string
  personalClanRating: number | null
  activity: number | null
}

export interface ClanPage {
  clanUrl: string
  clanName: string
  clanTag: string
  memberCount: number
  members: ClanMember[]
}

const MEMBER_ROW =
  /<div class="[^"]*squadrons-members__grid-item[^"]*">\s*([\s\S]*?)\s*<\/div>\s*<div class="[^"]*squadrons-members__grid-item[^"]*">\s*<a[^>]*href="[^"]*userinfo\/\?nick=([^"]+)"[^>]*>([\s\S]*?)<\/a>\s*<\/div>\s*<div class="[^"]*squadrons-members__grid-item[^"]*">\s*([\s\S]*?)\s*<\/div>\s*<div class="[^"]*squadrons-members__grid-item[^"]*">\s*([\s\S]*?)\s*<\/div>\s*<div class="[^"]*squadrons-members__grid-item[^"]*">\s*([\s\S]*?)\s*<\/div>\s*<div class="[^"]*squadrons-members__grid-item[^"]*">\s*([\s\S]*?)\s*<\/div>/g

function decodeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
}

function cleanText(value: string): string {
  return decodeHtml(value.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim()
}

function parseNumber(value: string): number | null {
  const cleaned = cleanText(value).replace(/[,\s]/g, '')
  if (cleaned === '' || !/^-?\d+$/.test(cleaned)) {
    return null
  }
  return Number(cleaned)
}

const ROLE_ALIASES: Record<string, string> = {
  'clan/sergeant': 'Sergeant',
}

export function normalizeSquadronRole(value: string): string | null {
  const cleaned = cleanText(value)
  if (cleaned === '') {
    return null
  }
  return ROLE_ALIASES[cleaned.toLocaleLowerCase('en')] ?? cleaned
}

export function parseClanDate(value: string): string {
  const cleaned = value.trim()
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(cleaned)
  if (match === null) {
    throw new Error(`Invalid clan date: "${value}"`)
  }

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Invalid clan date: "${value}"`)
  }

  return date.toISOString()
}

export function parseClanPage(html: string, clanUrl: string): ClanPage {
  const cleanedHtml = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/?noindex>/gi, '')
    .replace(/<div class="robots-nocontent">\s*([\s\S]*?)\s*<\/div>/gi, '$1')

  const titleMatch = /<div class="squadrons-info__title">\s*\[([^\]]+)\]\s*([^<]+)\s*<\/div>/.exec(
    cleanedHtml,
  )
  if (titleMatch === null) {
    throw new Error('Could not find the squadron title on the clan page.')
  }

  const clanTag = cleanText(titleMatch[1] ?? '')
  const clanName = cleanText(titleMatch[2] ?? '')
  const members: ClanMember[] = []

  for (const match of cleanedHtml.matchAll(MEMBER_ROW)) {
    const nickFromLink = match[2] ?? ''
    const nickFromText = cleanText(match[3] ?? '')
    let username = nickFromText
    try {
      username = decodeURIComponent(nickFromLink.replace(/\+/g, ' '))
    } catch {
      // Keep the visible nickname when the link is not valid percent-encoding.
    }
    if (username === '') {
      username = nickFromText
    }
    if (username === '') {
      continue
    }

    const role = normalizeSquadronRole(match[6] ?? '')
    const joinedAt = parseClanDate(cleanText(match[7] ?? ''))

    members.push({
      username,
      squadronRole: role,
      squadronJoinedAt: joinedAt,
      personalClanRating: parseNumber(match[4] ?? ''),
      activity: parseNumber(match[5] ?? ''),
    })
  }

  if (members.length === 0) {
    throw new Error('No squadron members were found on the clan page.')
  }

  const countMatch = /Number of players:\s*(\d+)/.exec(cleanedHtml)

  return {
    clanUrl,
    clanName,
    clanTag,
    memberCount: countMatch === null ? members.length : Number(countMatch[1]),
    members,
  }
}

export async function fetchClanPage(
  url: string,
  timeoutMs: number,
  userAgent: string,
): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': userAgent,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'en',
    },
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!response.ok) {
    throw new Error(`Clan page request failed (${response.status} ${response.statusText}).`)
  }

  return response.text()
}
