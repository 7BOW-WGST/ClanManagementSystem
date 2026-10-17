import { sql, type Kysely } from 'kysely'

// Create the account display-name history table (see DECISIONS R8/R10).
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('account_name_events')
    .addColumn('id', 'serial', (column) => column.primaryKey())
    .addColumn('account_id', 'integer', (column) => column.notNull().references('accounts.id'))
    .addColumn('name', 'text', (column) => column.notNull())
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
  await db.schema.dropTable('account_name_events').execute()
}
