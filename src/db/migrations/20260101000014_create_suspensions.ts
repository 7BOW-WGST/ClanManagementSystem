import { sql, type Kysely } from 'kysely'

// Create the section suspension intervals (see DECISIONS S1). The only time-bounded record.
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('suspensions')
    .addColumn('id', 'serial', (column) => column.primaryKey())
    .addColumn('member_id', 'integer', (column) => column.notNull().references('members.id'))
    .addColumn('section_id', 'integer', (column) => column.notNull().references('sections.id'))
    .addColumn('start_date', 'date', (column) => column.notNull())
    .addColumn('start_date_precision', 'text', (column) => column.notNull())
    .addColumn('end_date', 'date') // null = ongoing / indefinite
    .addColumn('end_date_precision', 'text')
    .addColumn('reason', 'text', (column) => column.notNull())
    .addColumn('recorded_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('source', 'text', (column) => column.notNull().defaultTo('manual'))
    .addColumn('created_by', 'text', (column) => column.notNull().defaultTo('owner'))
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('deleted_at', 'timestamptz')
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('suspensions').execute()
}
