import { describe, expect, test } from 'bun:test'
import { parseClanDate, parseClanPage } from './clan-page'

function memberRow(input: {
  index: number
  nickname: string
  hrefNickname: string
  rating: string
  activity: string
  role: string
  date: string
  noindex?: boolean
}): string {
  const inner = `<a href="en/community/userinfo/?nick=${input.hrefNickname}">${input.nickname}</a>`
  const nickCell = input.noindex
    ? `<noindex><div class="robots-nocontent">${inner}</div></noindex>`
    : inner

  return `
    <div class="squadrons-members__grid-item">${input.index}</div>
    <div class="squadrons-members__grid-item">${nickCell}</div>
    <div class="squadrons-members__grid-item">${input.rating}</div>
    <div class="squadrons-members__grid-item">${input.activity}</div>
    <div class="squadrons-members__grid-item global__mobile-hidden">${input.role}</div>
    <div class="squadrons-members__grid-item global__mobile-hidden">${input.date}</div>
  `
}

describe('parseClanDate', () => {
  test('converts DD.MM.YYYY to ISO 8601 UTC', () => {
    expect(parseClanDate('28.04.2020')).toBe('2020-04-28T00:00:00.000Z')
    expect(parseClanDate('01.01.1970')).toBe('1970-01-01T00:00:00.000Z')
  })

  test('rejects invalid calendar dates', () => {
    expect(() => parseClanDate('31.02.2020')).toThrow('Invalid clan date')
    expect(() => parseClanDate('2020-01-01')).toThrow('Invalid clan date')
  })
})

describe('parseClanPage', () => {
  test('parses clan metadata and member rows including noindex wrappers', () => {
    const html = `
      <div class="squadrons-info__title">[┾7BOW┿] 7 Brygada Obrony Wybrzeza</div>
      <div class="squadrons-info__meta-item">Number of players: 2</div>
      <div class="squadrons-profile__body squadrons-members">
        ${memberRow({
          index: 1,
          nickname: 'WOJTEK885',
          hrefNickname: 'WOJTEK885',
          rating: '1,384',
          activity: '1163',
          role: 'Commander',
          date: '28.04.2020',
        })}
        ${memberRow({
          index: 2,
          nickname: 'LION OF JUDAH',
          hrefNickname: 'LION%20OF%20JUDAH',
          rating: '0',
          activity: 'N/A',
          role: 'Private',
          date: '02.08.2024',
          noindex: true,
        })}
      </div>
    `

    const page = parseClanPage(html, 'https://warthunder.com/en/community/claninfo/test')

    expect(page.clanName).toBe('7 Brygada Obrony Wybrzeza')
    expect(page.clanTag).toBe('┾7BOW┿')
    expect(page.memberCount).toBe(2)
    expect(page.members).toEqual([
      {
        username: 'WOJTEK885',
        squadronRole: 'Commander',
        squadronJoinedAt: '2020-04-28T00:00:00.000Z',
        personalClanRating: 1384,
        activity: 1163,
      },
      {
        username: 'LION OF JUDAH',
        squadronRole: 'Private',
        squadronJoinedAt: '2024-08-02T00:00:00.000Z',
        personalClanRating: 0,
        activity: null,
      },
    ])
  })

  test('decodes HTML entities in nicknames', () => {
    const html = `
      <div class="squadrons-info__title">[TAG] Clan</div>
      ${memberRow({
        index: 1,
        nickname: 'A &amp; B',
        hrefNickname: 'A%20%26%20B',
        rating: '0',
        activity: '0',
        role: 'Private',
        date: '01.01.2024',
      })}
    `

    const page = parseClanPage(html, 'x')
    expect(page.members[0]?.username).toBe('A & B')
  })

  test('fails when the title or member rows are missing', () => {
    expect(() => parseClanPage('<html></html>', 'x')).toThrow('squadron title')
    expect(() =>
      parseClanPage('<div class="squadrons-info__title">[TAG] Clan</div>', 'x'),
    ).toThrow('No squadron members')
  })
})
