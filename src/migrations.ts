import type { Migration, MigrationProvider } from 'kysely/migration'
import * as createMembers from './migrations/20260101000000_create_members'
import * as createSections from './migrations/20260101000001_create_sections'
import * as createMemberNicknameEvents from './migrations/20260101000002_create_member_nickname_events'
import * as createMemberLifecycleEvents from './migrations/20260101000003_create_member_lifecycle_events'

const migrations: Record<string, Migration> = {
  '20260101000000_create_members': createMembers,
  '20260101000001_create_sections': createSections,
  '20260101000002_create_member_nickname_events': createMemberNicknameEvents,
  '20260101000003_create_member_lifecycle_events': createMemberLifecycleEvents,
}

export const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return migrations
  },
}
