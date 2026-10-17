import type { Kysely } from 'kysely'
import type { Database } from './types'

const sections = ['multigaming', 'warthunder', 'arma3'] as const // Define the sections to be seeded in the database

// Seed the database (app or test) with initial data
export async function seedDatabase(db: Kysely<Database>): Promise<void> {
  await db
    .insertInto('sections')
    .values(sections.map((name) => ({ name })))
    .onConflict((oc) => oc.column('name').doNothing()) // if name exists, skip (idempotent)
    .execute()
}
