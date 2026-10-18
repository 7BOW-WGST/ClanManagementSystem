import type { Kysely } from 'kysely'
import type { Database, RankCorps } from './types'

// Section catalog (base membership model).
const sections = ['multigaming', 'warthunder', 'arma3'] as const

// The shared rank catalog (see docs/development/CATALOGS.md). `order` leaves gaps so future ranks
// can be inserted without renumbering. `introduced_at` is unknown and left null.
const ranks: Array<{ name: string; corps: RankCorps; order: number }> = [
  { name: 'Elew', corps: 'enlisted', order: 10 },
  { name: 'Szeregowy', corps: 'enlisted', order: 20 },
  { name: 'Starszy Szeregowy', corps: 'enlisted', order: 30 },
  { name: 'Starszy Szeregowy Specjalista', corps: 'enlisted', order: 40 },
  { name: 'Kapral', corps: 'nco', order: 50 },
  { name: 'Starszy Kapral', corps: 'nco', order: 60 },
  { name: 'Plutonowy', corps: 'nco', order: 70 },
  { name: 'Starszy Plutonowy', corps: 'nco', order: 80 },
  { name: 'Sierżant', corps: 'nco', order: 90 },
  { name: 'Starszy Sierżant', corps: 'nco', order: 100 },
  { name: 'Sierżant Sztabowy', corps: 'nco', order: 110 },
  { name: 'Starszy Sierżant Sztabowy', corps: 'nco', order: 120 },
  { name: 'Młodszy Chorąży', corps: 'warrant', order: 130 },
  { name: 'Chorąży', corps: 'warrant', order: 140 },
  { name: 'Starszy Chorąży', corps: 'warrant', order: 150 },
  { name: 'Młodszy Chorąży Sztabowy', corps: 'warrant', order: 160 },
  { name: 'Chorąży Sztabowy', corps: 'warrant', order: 170 },
  { name: 'Starszy Chorąży Sztabowy', corps: 'warrant', order: 180 },
  { name: 'Podchorąży', corps: 'officer', order: 190 },
  { name: 'Podporucznik', corps: 'officer', order: 200 },
  { name: 'Porucznik', corps: 'officer', order: 210 },
  { name: 'Kapitan', corps: 'officer', order: 220 },
  { name: 'Major', corps: 'officer', order: 230 },
  { name: 'Podpułkownik', corps: 'officer', order: 240 },
  { name: 'Pułkownik', corps: 'officer', order: 250 },
]

// Seed the app or test database with initial catalog data (idempotent).
export async function seedDatabase(db: Kysely<Database>): Promise<void> {
  await db
    .insertInto('sections')
    .values(sections.map((name) => ({ name })))
    .onConflict((oc) => oc.column('name').doNothing()) // if name exists, skip
    .execute()

  await db
    .insertInto('ranks')
    .values(ranks)
    .onConflict((oc) => oc.column('name').doNothing()) // if name exists, skip
    .execute()
}
