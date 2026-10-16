import { Migrator } from 'kysely/migration'
import { closeDb, db } from './db'
import { migrationProvider } from './migrations'

const migrator = new Migrator({ db, provider: migrationProvider })

try {
  const { error, results } = await migrator.migrateToLatest()

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
} catch (err) {
  console.error(err)
  process.exitCode = 1
} finally {
  await closeDb()
}
