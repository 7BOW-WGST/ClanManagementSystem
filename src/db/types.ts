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
}
