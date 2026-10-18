import { type Kysely } from 'kysely'

// Create the award catalog (see DECISIONS M7/C2). Names are unique; tiered awards share a
// `tier_group` and differ by `tier_level`.
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('awards')
    .addColumn('id', 'serial', (column) => column.primaryKey())
    .addColumn('name', 'text', (column) => column.notNull().unique())
    .addColumn('category', 'text', (column) => column.notNull())
    .addColumn('tier_group', 'text')
    .addColumn('tier_level', 'text')
    .addColumn('requirement', 'text', (column) => column.notNull())
    .addColumn('max_per_member', 'integer') // null = unlimited
    .addColumn('requires_reason', 'boolean', (column) => column.notNull().defaultTo(false))
    .addColumn('introduced_at', 'integer') // year precision, nullable
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('awards').execute()
}
