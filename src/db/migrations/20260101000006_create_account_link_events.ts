import { sql, type Kysely } from 'kysely'

// Create the member <-> account link history table (see DECISIONS R11).
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('account_link_events')
    .addColumn('id', 'serial', (column) => column.primaryKey())
    .addColumn('account_id', 'integer', (column) => column.notNull().references('accounts.id'))
    .addColumn('member_id', 'integer', (column) => column.notNull().references('members.id'))
    .addColumn('action', 'text', (column) => column.notNull()) // link | unlink | relation_change
    .addColumn('relation', 'text') // main | alt | borrowed (War Thunder only)
    .addColumn('event_date', 'date')
    .addColumn('event_date_precision', 'text', (column) => column.notNull())
    .addColumn('recorded_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('source', 'text', (column) => column.notNull().defaultTo('manual'))
    .addColumn('created_by', 'text', (column) => column.notNull().defaultTo('owner'))
    .addColumn('reason', 'text')
    .addColumn('deleted_at', 'timestamptz')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('account_link_events').execute()
}
