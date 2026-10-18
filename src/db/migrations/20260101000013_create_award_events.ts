import { sql, type Kysely } from 'kysely'

// Create the award grant/revoke/upgrade history (see DECISIONS M7). Each grant row is an
// instance; revoke/upgrade target a specific instance via `target_event_id`.
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('award_events')
    .addColumn('id', 'serial', (column) => column.primaryKey())
    .addColumn('member_id', 'integer', (column) => column.notNull().references('members.id'))
    .addColumn('award_id', 'integer', (column) => column.notNull().references('awards.id'))
    .addColumn('type', 'text', (column) => column.notNull()) // grant | revoke | upgrade
    .addColumn('target_event_id', 'integer', (column) => column.references('award_events.id'))
    .addColumn('event_date', 'date')
    .addColumn('event_date_precision', 'text', (column) => column.notNull())
    .addColumn('reason', 'text')
    .addColumn('recorded_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('source', 'text', (column) => column.notNull().defaultTo('manual'))
    .addColumn('created_by', 'text', (column) => column.notNull().defaultTo('owner'))
    .addColumn('deleted_at', 'timestamptz')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('award_events').execute()
}
