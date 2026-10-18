import { sql, type Kysely } from 'kysely'

// Create the Arma 3 rank promotion/demotion history (independent of the core stream, same catalog).
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('arma3_promotion_events')
    .addColumn('id', 'serial', (column) => column.primaryKey())
    .addColumn('member_id', 'integer', (column) => column.notNull().references('members.id'))
    .addColumn('rank_id', 'integer', (column) => column.notNull().references('ranks.id'))
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
  await db.schema.dropTable('arma3_promotion_events').execute()
}
