import { sql, type Kysely } from 'kysely'

// Create the external platform accounts table (see DECISIONS R1/R4/R10).
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('accounts')
    .addColumn('id', 'serial', (column) => column.primaryKey())
    .addColumn('platform', 'text', (column) => column.notNull())
    .addColumn('platform_id', 'text') // nullable: provisional account with an unknown identifier
    .addColumn('created_event_date', 'date')
    .addColumn('created_event_date_precision', 'text')
    .addColumn('recorded_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('source', 'text', (column) => column.notNull().defaultTo('manual'))
    .addColumn('updated_at', 'timestamptz', (column) => column.notNull().defaultTo(sql`now()`))
    .addColumn('deleted_at', 'timestamptz')
    .execute()

  // Enforce one account per known (platform, platform_id); provisional accounts (null id) are excluded.
  await sql`create unique index accounts_platform_platform_id_key on accounts (platform, platform_id) where platform_id is not null`.execute(
    db,
  )
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('accounts').execute()
}
