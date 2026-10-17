import { closeDb, db } from './db'
import { seedDatabase } from './seed-data'

// Run seeding
try {
  await seedDatabase(db)
  console.log('seed complete')
} catch (err) {
  console.error(err)
  process.exitCode = 1
} finally {
  await closeDb()
}
