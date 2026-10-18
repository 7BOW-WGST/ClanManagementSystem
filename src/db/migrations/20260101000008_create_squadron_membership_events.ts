import { sql, type Kysely } from 'kysely'

// Create the War Thunder squadron membership history table (see DECISIONS R6).
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('squadron_membership_events')
    .addColumn('id', 'serial', (column) => column.primaryKey())
    .addColumn('account_id', 'integer', (column) => column.notNull().references('accounts.id'))
    .addColumn('squadron', 'text', (column) => column.notNull()) // 7BOW | 7BOWs | 7BOWr
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
  await db.schema.dropTable('squadron_membership_events').execute()
}
