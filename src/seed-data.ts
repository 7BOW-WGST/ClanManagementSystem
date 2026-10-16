import type { Kysely } from 'kysely'
import type { Database } from './types'

const sections = ['multigaming', 'warthunder', 'arma3'] as const

export async function seedDatabase(db: Kysely<Database>): Promise<void> {
  await db
    .insertInto('sections')
    .values(sections.map((name) => ({ name })))
    .onConflict((oc) => oc.column('name').doNothing())
    .execute()
}
