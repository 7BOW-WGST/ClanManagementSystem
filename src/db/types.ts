import type { Generated } from 'kysely'

// Precision at which an event date is known (see docs/development/DECISIONS.md H9).
export type EventDatePrecision = 'day' | 'month' | 'year' | 'unknown'

// Source of an entry; manual entries win only as a same-date tie-break (see CS1).
export type Source = 'manual' | 'auto'

export interface Member {
  id: Generated<number>
  recorded_at: Generated<Date>
  source: Generated<Source>
  updated_at: Generated<Date>
  deleted_at: Date | null
}

export interface Section {
  id: Generated<number>
  name: string
}

// External platforms a member can have an account on.
export type Platform = 'discord' | 'warthunder' | 'arma3units' | 'steam'

export interface Account {
  id: Generated<number>
  platform: Platform
  platform_id: string | null
  created_event_date: string | null
  created_event_date_precision: EventDatePrecision | null
  recorded_at: Generated<Date>
  source: Generated<Source>
  updated_at: Generated<Date>
  deleted_at: Date | null
}

export interface AccountNameEvent {
  id: Generated<number>
  account_id: number
  name: string
  event_date: string | null
  event_date_precision: EventDatePrecision
  recorded_at: Generated<Date>
  source: Generated<Source>
  created_by: Generated<string>
  reason: string | null
  deleted_at: Date | null
}

// Actions on a member <-> account link stream.
export type LinkAction = 'link' | 'unlink' | 'relation_change'

// War Thunder account relation (see DECISIONS R2).
export type Relation = 'main' | 'alt' | 'borrowed'

export interface AccountLinkEvent {
  id: Generated<number>
  account_id: number
  member_id: number
  action: LinkAction
  relation: Relation | null
  event_date: string | null
  event_date_precision: EventDatePrecision
  recorded_at: Generated<Date>
  source: Generated<Source>
  created_by: Generated<string>
  reason: string | null
  deleted_at: Date | null
}

export interface AccountMergeAudit {
  id: Generated<number>
  canonical_account_id: number
  merged_account_id: number
  reason: string | null
  recorded_at: Generated<Date>
  created_by: Generated<string>
  source: Generated<Source>
}

// War Thunder squadrons (see REQUIREMENTS §4.2).
export type Squadron = '7BOW' | '7BOWs' | '7BOWr'

// A join/leave membership event (used by squadron, section and group histories).
export type MembershipEventType = 'join' | 'leave'

export interface SquadronMembershipEvent {
  id: Generated<number>
  account_id: number
  squadron: Squadron
  type: MembershipEventType
  event_date: string | null
  event_date_precision: EventDatePrecision
  recorded_at: Generated<Date>
  source: Generated<Source>
  created_by: Generated<string>
  deleted_at: Date | null
}

// Rank corps (see CATALOGS.md).
export type RankCorps = 'enlisted' | 'nco' | 'warrant' | 'officer'

export interface Rank {
  id: Generated<number>
  name: string
  corps: RankCorps
  order: number
  introduced_at: number | null
}

export interface CorePromotionEvent {
  id: Generated<number>
  member_id: number
  rank_id: number
  event_date: string | null
  event_date_precision: EventDatePrecision
  recorded_at: Generated<Date>
  source: Generated<Source>
  created_by: Generated<string>
  reason: string | null
  deleted_at: Date | null
}

// Veteran status events (see DECISIONS M4).
export type VeteranEventType = 'granted' | 'removed'

export interface VeteranEvent {
  id: Generated<number>
  member_id: number
  type: VeteranEventType
  event_date: string | null
  event_date_precision: EventDatePrecision
  recorded_at: Generated<Date>
  source: Generated<Source>
  created_by: Generated<string>
  deleted_at: Date | null
}

// Award catalog and instances (see DECISIONS M7/C2).
export type AwardEventType = 'grant' | 'revoke' | 'upgrade'

export interface Award {
  id: Generated<number>
  name: string
  category: string
  tier_group: string | null
  tier_level: string | null
  requirement: string
  max_per_member: number | null
  requires_reason: boolean
  introduced_at: number | null
}

export interface AwardEvent {
  id: Generated<number>
  member_id: number
  award_id: number
  type: AwardEventType
  target_event_id: number | null
  event_date: string | null
  event_date_precision: EventDatePrecision
  reason: string | null
  recorded_at: Generated<Date>
  source: Generated<Source>
  created_by: Generated<string>
  deleted_at: Date | null
}

// Section-scoped suspension interval (see DECISIONS S1).
export interface Suspension {
  id: Generated<number>
  member_id: number
  section_id: number
  start_date: string
  start_date_precision: EventDatePrecision
  end_date: string | null
  end_date_precision: EventDatePrecision | null
  reason: string
  recorded_at: Generated<Date>
  source: Generated<Source>
  created_by: Generated<string>
  updated_at: Generated<Date>
  deleted_at: Date | null
}

// Arma 3 section membership and rank stream (member-scoped).
export interface Arma3SectionEvent {
  id: Generated<number>
  member_id: number
  type: MembershipEventType
  event_date: string | null
  event_date_precision: EventDatePrecision
  recorded_at: Generated<Date>
  source: Generated<Source>
  created_by: Generated<string>
  deleted_at: Date | null
}

export interface Arma3PromotionEvent {
  id: Generated<number>
  member_id: number
  rank_id: number
  event_date: string | null
  event_date_precision: EventDatePrecision
  recorded_at: Generated<Date>
  source: Generated<Source>
  created_by: Generated<string>
  reason: string | null
  deleted_at: Date | null
}

export interface MemberNicknameEvent {
  id: Generated<number>
  member_id: number
  nickname: string
  event_date: string | null
  event_date_precision: EventDatePrecision
  recorded_at: Generated<Date>
  source: Generated<Source>
  created_by: Generated<string>
  reason: string | null
  deleted_at: Date | null
}

export interface MemberLifecycleEvent {
  id: Generated<number>
  member_id: number
  type: string
  event_date: string | null
  event_date_precision: EventDatePrecision
  recorded_at: Generated<Date>
  source: Generated<Source>
  created_by: Generated<string>
  reason: string | null
  deleted_at: Date | null
}

export interface Database {
  members: Member
  sections: Section
  member_nickname_events: MemberNicknameEvent
  member_lifecycle_events: MemberLifecycleEvent
  accounts: Account
  account_name_events: AccountNameEvent
  account_link_events: AccountLinkEvent
  account_merge_audit: AccountMergeAudit
  squadron_membership_events: SquadronMembershipEvent
  ranks: Rank
  core_promotion_events: CorePromotionEvent
  veteran_events: VeteranEvent
  awards: Award
  award_events: AwardEvent
  suspensions: Suspension
  arma3_section_events: Arma3SectionEvent
  arma3_promotion_events: Arma3PromotionEvent
}
