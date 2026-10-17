import { sql, type Kysely } from 'kysely'

// Create the account merge audit table (see DECISIONS MO1/R5).
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('account_merge_audit')
    .addColumn('id', 'serial', (column) => column.primaryKey())
    .addColumn('canonical_account_id', 'integer', (column) => column.notNull().references('accounts.id'))
    .addColumn('merged_account_id', 'integer', (column) => column.notNull().references('accounts.id'))
    .addColumn('reason', 'text')
    .addColumn('recorded_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('created_by', 'text', (column) => column.notNull().defaultTo('owner'))
    .addColumn('source', 'text', (column) => column.notNull().defaultTo('manual'))
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('account_merge_audit').execute()
}
