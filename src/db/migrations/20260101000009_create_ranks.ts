import { type Kysely } from 'kysely'

// Create the shared rank catalog (see DECISIONS M6/C1). Append-only; names are unique.
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable('ranks')
    .addColumn('id', 'serial', (column) => column.primaryKey())
    .addColumn('name', 'text', (column) => column.notNull().unique())
    .addColumn('corps', 'text', (column) => column.notNull()) // enlisted | nco | warrant | officer
    .addColumn('order', 'integer', (column) => column.notNull())
    .addColumn('introduced_at', 'integer') // year precision, nullable
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.dropTable('ranks').execute()
}
