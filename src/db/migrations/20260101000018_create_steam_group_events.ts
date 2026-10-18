import { sql, type Kysely } from 'kysely'

// Create the Steam group membership history (account-scoped join/leave).
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('steam_group_events')
    .addColumn('id', 'serial', (column) => column.primaryKey())
    .addColumn('account_id', 'integer', (column) => column.notNull().references('accounts.id'))
    .addColumn('type', 'text', (column) => column.notNull()) // join | leave
    .addColumn('event_date', 'date')
    .addColumn('event_date_precision', 'text', (column) => column.notNull())
    .addColumn('recorded_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('source', 'text', (column) => column.notNull().defaultTo('manual'))
    .addColumn('created_by', 'text', (column) => column.notNull().defaultTo('owner'))
    .addColumn('deleted_at', 'timestamptz')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('steam_group_events').execute()
}
