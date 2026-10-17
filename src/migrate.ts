import { Migrator } from 'kysely/migration'
import { closeDb, db } from './db'
import { migrationProvider } from './migrations'

const migrator = new Migrator({ db, provider: migrationProvider }) // Wire the migrator to the DB + provider

// Run the migrations
try {
  const { error, results } = await migrator.migrateToLatest()

  // Log the results of each migration
  for (const result of results ?? []) {
    if (result.status === 'Success') {
      console.log(`migrated: ${result.migrationName}`)
    } else if (result.status === 'Error') {
      console.error(`failed: ${result.migrationName}`)
    }
  }

  if (error) {
    console.error(error)
    process.exitCode = 1
  } else {
    console.log('migrations up to date')
  }
} catch (err) { // Catch any unexpected errors during migration
  console.error(err)
  process.exitCode = 1
} finally {
  await closeDb()
}
