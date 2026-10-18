import { type Kysely } from 'kysely'

// Drop rank/suspension reasons; give suspensions a free-text scope.
export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('core_promotion_events').dropColumn('reason').execute()
  await db.schema.alterTable('arma3_promotion_events').dropColumn('reason').execute()
  await db.schema.alterTable('suspensions').dropColumn('reason').execute()
  await db.schema
    .alterTable('suspensions')
    .addColumn('scope', 'text', (column) => column.notNull().defaultTo(''))
    .execute()
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable('core_promotion_events').addColumn('reason', 'text').execute()
  await db.schema.alterTable('arma3_promotion_events').addColumn('reason', 'text').execute()
  await db.schema
    .alterTable('suspensions')
    .addColumn('reason', 'text', (column) => column.notNull().defaultTo(''))
    .execute()
  await db.schema.alterTable('suspensions').dropColumn('scope').execute()
}
