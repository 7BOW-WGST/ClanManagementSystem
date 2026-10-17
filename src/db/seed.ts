import { closeDb, getDb } from './client'
import { seedDatabase } from './seed-data'

try {
  await seedDatabase(getDb())
  console.log('seed complete')
} catch (err) {
  console.error(err)
  process.exitCode = 1
} finally {
  await closeDb()
}
