import { Hono } from 'hono'
import { createAccount, isPlatform, memberAccountViews, platformIdTaken, type MemberAccountView } from '../accounts/data'
import { activeAwards, awardHistory, listAwards, type ActiveAward, type AwardHistoryEntry, type AwardRow } from '../awards/data'
import { getDb } from '../db/client'
import { parseDateInput } from '../lib/date'
import { consumeFlash, setFlash } from '../lib/flash'
import { pageCount, pageParams } from '../lib/pagination'
import { currentRole, requireRole } from '../lib/role'
import { coreRankHistory, currentArma3Rank, currentCoreRank, arma3RankHistory, listRanks, type RankHistoryEntry, type RankRow } from '../ranks/data'
import {
  arma3SectionActive,
  arma3SectionHistory,
  listSections,
  memberWarThunder,
  suspensionViews,
  type Arma3SectionEventRow,
  type SectionRow,
  type SuspensionView,
  type WarThunderMembership,
} from '../sections/data'
import { stringField } from '../lib/validation'
import {
  addLifecycleEvent,
  addNicknameEvent,
  addVeteranEvent,
  buildTimeline,
  correctLifecycleEvent,
  correctNicknameEvent,
  countMembers,
  createMember,
  currentVeteran,
  getMemberDetail,
  isLifecycleType,
  lifecycleWarnings,
  listMembers,
  softDeleteLifecycleEvent,
  softDeleteNicknameEvent,
  softDeleteVeteranEvent,
  veteranEvents,
  type MemberDetail,
} from './data'
import { MemberDetailPage, MemberListPage, MemberNewPage, MemberTimelinePage } from './views'

// Router for member routes (mounted at the application root).
export const memberRoutes = new Hono()

// Parse a member id from a route parameter.
function parseId(raw: string | undefined): number | undefined {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : undefined
}

// Load a member detail plus the data its page needs.
async function detailContext(id: number): Promise<
  | {
      member: MemberDetail
      accounts: MemberAccountView[]
      warThunder: WarThunderMembership
      coreRankName: string | null
      rankHistory: RankHistoryEntry[]
      ranks: RankRow[]
      veteran: boolean
      awards: AwardRow[]
      activeAwards: ActiveAward[]
      awardHistory: AwardHistoryEntry[]
      suspensions: SuspensionView[]
      sections: SectionRow[]
      arma3Active: boolean
      arma3RankName: string | null
      arma3RankHistory: RankHistoryEntry[]
      arma3SectionHistory: Arma3SectionEventRow[]
    }
  | undefined
> {
  const db = getDb()
  const member = await getMemberDetail(db, id)
  if (!member) {
    return undefined
  }
  const [accounts, warThunder, coreRank, rankHistory, ranks, veteran, awards, active, history, suspensions, sections, arma3Active, arma3Sections, arma3History] =
    await Promise.all([
      memberAccountViews(db, id),
      memberWarThunder(db, id),
      currentCoreRank(db, id),
      coreRankHistory(db, id),
      listRanks(db),
      currentVeteran(db, id),
      listAwards(db),
      activeAwards(db, id),
      awardHistory(db, id),
      suspensionViews(db, id),
      listSections(db),
      arma3SectionActive(db, id),
      arma3SectionHistory(db, id),
      arma3RankHistory(db, id),
    ])
  const arma3Rank = arma3Active ? await currentArma3Rank(db, id) : null

  return {
    member,
    accounts,
    warThunder,
    coreRankName: coreRank?.name ?? null,
    rankHistory,
    ranks,
    veteran,
    awards,
    activeAwards: active,
    awardHistory: history,
    suspensions,
    sections,
    arma3Active,
    arma3RankName: arma3Rank?.name ?? null,
    arma3RankHistory: arma3History,
    arma3SectionHistory: arma3Sections,
  }
}

// Members list.
memberRoutes.get('/members', async (c) => {
  const { page, limit, offset } = pageParams(c)
  const q = c.req.query('q')
  const db = getDb()
  const [members, total] = await Promise.all([listMembers(db, { limit, offset, search: q }), countMembers(db, q)])
  return c.html(
    <MemberListPage role={currentRole(c)} members={members} page={page} totalPages={pageCount(total, limit)} q={q} flash={consumeFlash(c)} />,
  )
})

// New member form.
memberRoutes.get('/members/new', requireRole('owner', 'admin'), (c) =>
  c.html(<MemberNewPage role={currentRole(c)} />),
)

// Create a member (onboarding: identity + nickname + optional join + optional account).
memberRoutes.post('/members', requireRole('owner', 'admin'), async (c) => {
  const body = await c.req.parseBody()
  const nickname = stringField(body, 'nickname')
  const date = parseDateInput(stringField(body, 'nickname_date_precision') ?? 'unknown', stringField(body, 'nickname_date') ?? '')
  const wantsJoin = stringField(body, 'join') !== undefined
  const joinDate = parseDateInput(stringField(body, 'join_date_precision') ?? 'unknown', stringField(body, 'join_date') ?? '')
  const platform = stringField(body, 'platform')
  const platformId = stringField(body, 'platform_id')
  const accountName = stringField(body, 'account_name')

  const rerender = (error: string) =>
    c.html(
      <MemberNewPage
        role={currentRole(c)}
        error={error}
        nickname={nickname}
        date={stringField(body, 'nickname_date')}
        datePrecision={stringField(body, 'nickname_date_precision')}
        joinChecked={wantsJoin}
        joinDate={stringField(body, 'join_date')}
        joinDatePrecision={stringField(body, 'join_date_precision')}
        platform={platform}
        platformId={platformId}
        accountName={accountName}
      />,
      400,
    )

  if (!date.ok) {
    return rerender(date.error)
  }
  if (wantsJoin && !joinDate.ok) {
    return rerender(joinDate.error)
  }

  const hasAccount = platform !== undefined && platform !== ''
  if (hasAccount && !isPlatform(platform)) {
    return rerender('Choose a valid platform.')
  }

  const db = getDb()
  if (hasAccount && platformId !== undefined && (await platformIdTaken(db, platform, platformId))) {
    return rerender('An account with this identifier already exists for this platform.')
  }

  const id = await createMember(db, { nickname: nickname ?? null, eventDate: date.date, precision: date.precision })

  if (wantsJoin) {
    await addLifecycleEvent(db, {
      memberId: id,
      type: 'join',
      eventDate: joinDate.ok ? joinDate.date : null,
      precision: joinDate.ok ? joinDate.precision : 'unknown',
    })
  }

  if (hasAccount) {
    await createAccount(db, {
      platform,
      platformId: platformId ?? null,
      name: accountName ?? null,
      nameDate: null,
      namePrecision: 'unknown',
      createdDate: null,
      createdPrecision: null,
    })
  }

  setFlash(c, 'Member created.')
  return c.redirect(`/members/${id}`)
})

// Member detail.
memberRoutes.get('/members/:id', async (c) => {
  const id = parseId(c.req.param('id'))
  if (id === undefined) {
    return c.notFound()
  }
  const context = await detailContext(id)
  if (!context) {
    return c.notFound()
  }
  return c.html(
    <MemberDetailPage
      role={currentRole(c)}
      member={context.member}
      accounts={context.accounts}
      warThunder={context.warThunder}
      coreRankName={context.coreRankName}
      rankHistory={context.rankHistory}
      ranks={context.ranks}
      veteran={context.veteran}
      awards={context.awards}
      activeAwards={context.activeAwards}
      awardHistory={context.awardHistory}
      suspensions={context.suspensions}
      sections={context.sections}
      arma3Active={context.arma3Active}
      arma3RankName={context.arma3RankName}
      arma3RankHistory={context.arma3RankHistory}
      arma3SectionHistory={context.arma3SectionHistory}
      flash={consumeFlash(c)}
    />,
  )
})

// Add a nickname event to a member.
memberRoutes.post('/members/:id/nickname', requireRole('owner', 'admin'), async (c) => {
  const id = parseId(c.req.param('id'))
  const context = id === undefined ? undefined : await detailContext(id)
  if (id === undefined || !context) {
    return c.notFound()
  }

  const body = await c.req.parseBody()
  const nickname = stringField(body, 'nickname')
  const parsed = parseDateInput(stringField(body, 'event_date_precision') ?? 'unknown', stringField(body, 'event_date') ?? '')

  const rerender = (error: string) =>
    c.html(
      <MemberDetailPage
        role={currentRole(c)}
        member={context.member}
        accounts={context.accounts}
        warThunder={context.warThunder}
        coreRankName={context.coreRankName}
        rankHistory={context.rankHistory}
        ranks={context.ranks}
        veteran={context.veteran}
        awards={context.awards}
        activeAwards={context.activeAwards}
        awardHistory={context.awardHistory}
        suspensions={context.suspensions}
        sections={context.sections}
        arma3Active={context.arma3Active}
        arma3RankName={context.arma3RankName}
        arma3RankHistory={context.arma3RankHistory}
        arma3SectionHistory={context.arma3SectionHistory}
        error={error}
      />,
      400,
    )

  if (!nickname) {
    return rerender('Nickname is required.')
  }
  if (!parsed.ok) {
    return rerender(parsed.error)
  }

  await addNicknameEvent(getDb(), { memberId: id, nickname, eventDate: parsed.date, precision: parsed.precision })
  setFlash(c, 'Nickname added.')
  return c.redirect(`/members/${id}`)
})

// Add a lifecycle event (join / leave / kick) to a member.
memberRoutes.post('/members/:id/lifecycle', requireRole('owner', 'admin'), async (c) => {
  const id = parseId(c.req.param('id'))
  const context = id === undefined ? undefined : await detailContext(id)
  if (id === undefined || !context) {
    return c.notFound()
  }

  const body = await c.req.parseBody()
  const type = stringField(body, 'type')
  const parsed = parseDateInput(stringField(body, 'event_date_precision') ?? 'unknown', stringField(body, 'event_date') ?? '')

  const rerender = (error: string) =>
    c.html(
      <MemberDetailPage
        role={currentRole(c)}
        member={context.member}
        accounts={context.accounts}
        warThunder={context.warThunder}
        coreRankName={context.coreRankName}
        rankHistory={context.rankHistory}
        ranks={context.ranks}
        veteran={context.veteran}
        awards={context.awards}
        activeAwards={context.activeAwards}
        awardHistory={context.awardHistory}
        suspensions={context.suspensions}
        sections={context.sections}
        arma3Active={context.arma3Active}
        arma3RankName={context.arma3RankName}
        arma3RankHistory={context.arma3RankHistory}
        arma3SectionHistory={context.arma3SectionHistory}
        error={error}
      />,
      400,
    )

  if (!isLifecycleType(type)) {
    return rerender('Choose a lifecycle type.')
  }
  if (!parsed.ok) {
    return rerender(parsed.error)
  }

  const db = getDb()
  await addLifecycleEvent(db, { memberId: id, type, eventDate: parsed.date, precision: parsed.precision })
  const warnings = await lifecycleWarnings(db, id)
  setFlash(c, warnings.length > 0 ? warnings.join(' ') : 'Lifecycle event added.')
  return c.redirect(`/members/${id}`)
})

// Record a veteran status change.
memberRoutes.post('/members/:id/veteran', requireRole('owner', 'admin'), async (c) => {
  const id = parseId(c.req.param('id'))
  if (id === undefined) {
    return c.notFound()
  }

  const body = await c.req.parseBody()
  const type = stringField(body, 'type')
  const parsed = parseDateInput(stringField(body, 'event_date_precision') ?? 'unknown', stringField(body, 'event_date') ?? '')

  if (type !== 'granted' && type !== 'removed') {
    setFlash(c, 'Choose a veteran change.')
    return c.redirect(`/members/${id}`)
  }
  if (!parsed.ok) {
    setFlash(c, parsed.error)
    return c.redirect(`/members/${id}`)
  }

  await addVeteranEvent(getDb(), { memberId: id, type, eventDate: parsed.date, precision: parsed.precision })
  setFlash(c, 'Veteran status recorded.')
  return c.redirect(`/members/${id}`)
})

// Member timeline.
memberRoutes.get('/members/:id/timeline', async (c) => {
  const id = parseId(c.req.param('id'))
  if (id === undefined) {
    return c.notFound()
  }
  const db = getDb()
  const member = await getMemberDetail(db, id)
  if (!member) {
    return c.notFound()
  }
  const [ranks, veterans] = await Promise.all([coreRankHistory(db, id), veteranEvents(db, id)])
  const timeline = buildTimeline({ nicknames: member.nicknames, lifecycle: member.lifecycle, ranks, veterans })
  return c.html(<MemberTimelinePage role={currentRole(c)} memberId={id} timeline={timeline} flash={consumeFlash(c)} />)
})

// Correct a nickname event (timeline).
memberRoutes.post('/members/:id/nickname/:eventId', requireRole('owner', 'admin'), async (c) => {
  const id = parseId(c.req.param('id'))
  const eventId = parseId(c.req.param('eventId'))
  if (id === undefined || eventId === undefined) {
    return c.notFound()
  }

  const body = await c.req.parseBody()
  const nickname = stringField(body, 'nickname')
  const parsed = parseDateInput(stringField(body, 'event_date_precision') ?? 'unknown', stringField(body, 'event_date') ?? '')

  if (!nickname) {
    setFlash(c, 'Nickname is required.')
    return c.redirect(`/members/${id}/timeline`)
  }
  if (!parsed.ok) {
    setFlash(c, parsed.error)
    return c.redirect(`/members/${id}/timeline`)
  }

  await correctNicknameEvent(getDb(), { eventId, nickname, eventDate: parsed.date, precision: parsed.precision })
  setFlash(c, 'Nickname corrected.')
  return c.redirect(`/members/${id}/timeline`)
})

// Soft-delete a nickname event (timeline).
memberRoutes.post('/members/:id/nickname/:eventId/delete', requireRole('owner', 'admin'), async (c) => {
  const id = parseId(c.req.param('id'))
  const eventId = parseId(c.req.param('eventId'))
  if (id === undefined || eventId === undefined) {
    return c.notFound()
  }

  await softDeleteNicknameEvent(getDb(), eventId)
  setFlash(c, 'Nickname event deleted.')
  return c.redirect(`/members/${id}/timeline`)
})

// Correct a lifecycle event (timeline).
memberRoutes.post('/members/:id/lifecycle/:eventId', requireRole('owner', 'admin'), async (c) => {
  const id = parseId(c.req.param('id'))
  const eventId = parseId(c.req.param('eventId'))
  if (id === undefined || eventId === undefined) {
    return c.notFound()
  }

  const body = await c.req.parseBody()
  const type = stringField(body, 'type')
  const parsed = parseDateInput(stringField(body, 'event_date_precision') ?? 'unknown', stringField(body, 'event_date') ?? '')

  if (!isLifecycleType(type)) {
    setFlash(c, 'Choose a lifecycle type.')
    return c.redirect(`/members/${id}/timeline`)
  }
  if (!parsed.ok) {
    setFlash(c, parsed.error)
    return c.redirect(`/members/${id}/timeline`)
  }

  const db = getDb()
  await correctLifecycleEvent(db, { eventId, type, eventDate: parsed.date, precision: parsed.precision })
  const warnings = await lifecycleWarnings(db, id)
  setFlash(c, warnings.length > 0 ? warnings.join(' ') : 'Lifecycle event corrected.')
  return c.redirect(`/members/${id}/timeline`)
})

// Soft-delete a lifecycle event (timeline).
memberRoutes.post('/members/:id/lifecycle/:eventId/delete', requireRole('owner', 'admin'), async (c) => {
  const id = parseId(c.req.param('id'))
  const eventId = parseId(c.req.param('eventId'))
  if (id === undefined || eventId === undefined) {
    return c.notFound()
  }

  await softDeleteLifecycleEvent(getDb(), eventId)
  setFlash(c, 'Lifecycle event deleted.')
  return c.redirect(`/members/${id}/timeline`)
})

// Soft-delete a veteran event (timeline).
memberRoutes.post('/members/:id/veteran/:eventId/delete', requireRole('owner', 'admin'), async (c) => {
  const id = parseId(c.req.param('id'))
  const eventId = parseId(c.req.param('eventId'))
  if (id === undefined || eventId === undefined) {
    return c.notFound()
  }

  await softDeleteVeteranEvent(getDb(), eventId)
  setFlash(c, 'Veteran event deleted.')
  return c.redirect(`/members/${id}/timeline`)
})
