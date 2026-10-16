import type { Generated } from 'kysely'

export interface Member {
  id: Generated<number>
  recorded_at: Generated<Date>
  source: Generated<string>
  updated_at: Generated<Date>
  deleted_at: Date | null
}

export interface Section {
  id: Generated<number>
  name: string
}

export interface Database {
  members: Member
  sections: Section
}
