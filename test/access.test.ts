import { describe, expect, test } from 'bun:test'
import { canMutate } from '../src/lib/role'
import { MemberListPage, MemberTimelinePage } from '../src/members/views'
import { SuspensionHistory } from '../src/sections/views'
import type { TimelineEntry } from '../src/members/data'
import type { SuspensionView } from '../src/sections/data'

// Render a component function to an HTML string.
function render(element: unknown): string {
  return String(element)
}

describe('canMutate', () => {
  test('only owner and admin may mutate', () => {
    expect(canMutate('owner')).toBe(true)
    expect(canMutate('admin')).toBe(true)
    expect(canMutate('member')).toBe(false)
  })
})

describe('member-visible rendering', () => {
  test('the "new member" action is hidden for the member role', () => {
    const asOwner = render(MemberListPage({ role: 'owner', members: [], page: 1, totalPages: 1 }))
    const asMember = render(MemberListPage({ role: 'member', members: [], page: 1, totalPages: 1 }))

    expect(asOwner).toContain('/members/new')
    expect(asMember).not.toContain('/members/new')
  })

  test('timeline actions are hidden for the member role', () => {
    const timeline: TimelineEntry[] = [
      { key: 'nickname-1', date: '2020-01-01', precision: 'day', label: 'Kamil', kind: 'nickname', eventId: 1 },
    ]
    const asOwner = render(MemberTimelinePage({ role: 'owner', memberId: 1, timeline }))
    const asMember = render(MemberTimelinePage({ role: 'member', memberId: 1, timeline }))

    expect(asOwner).toContain('/members/1/nickname/1/delete')
    expect(asMember).not.toContain('/members/1/nickname/1/delete')
  })

  test('suspension scope is shown', () => {
    const events: SuspensionView[] = [
      { id: 1, sectionName: 'arma3', startDate: '2021-01-01', startDatePrecision: 'day', endDate: null, endDatePrecision: null, scope: 'secret scope', active: true },
    ]

    expect(render(SuspensionHistory({ events }))).toContain('secret scope')
  })
})

describe('member mutation is rejected server-side', () => {
  test('a POST as member returns 403', async () => {
    process.env.DEV_ROLE_SELECTOR = 'true'
    const { app } = await import('../src/app')

    const response = await app.request('/members', { method: 'POST', headers: { cookie: 'role=member' } })
    expect(response.status).toBe(403)
  })
})
