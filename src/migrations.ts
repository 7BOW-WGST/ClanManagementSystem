import type { Migration, MigrationProvider } from 'kysely/migration'
import * as createMembers from './migrations/20260101000000_create_members'
import * as createSections from './migrations/20260101000001_create_sections'

// Typed map of migrations for Kysely
const migrations: Record<string, Migration> = {
  '20260101000000_create_members': createMembers,
  '20260101000001_create_sections': createSections,
}

export const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return migrations
  },
}
