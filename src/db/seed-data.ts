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

// The award catalog (see docs/development/CATALOGS.md). Tiered awards share a `tier_group` and
// differ by text `tier_level`. `max_per_member` null means unlimited.
interface AwardSeed {
  name: string
  category: string
  tier_group: string | null
  tier_level: string | null
  requirement: string
  max_per_member: number | null
  requires_reason: boolean
}

const awards: AwardSeed[] = [
  // Krzyże Zasługi — separate awards, unlimited, reason required.
  { name: 'Złoty Krzyż Zasługi', category: 'Krzyże Zasługi', tier_group: null, tier_level: null, requirement: 'Za wniesienie znacznego wkładu w rozwój brygady (najwyższa skala)', max_per_member: null, requires_reason: true },
  { name: 'Srebrny Krzyż Zasługi', category: 'Krzyże Zasługi', tier_group: null, tier_level: null, requirement: 'Za wniesienie znacznego wkładu w rozwój brygady (środkowa skala)', max_per_member: null, requires_reason: true },
  { name: 'Brązowy Krzyż Zasługi', category: 'Krzyże Zasługi', tier_group: null, tier_level: null, requirement: 'Za wniesienie znacznego wkładu w rozwój brygady (najniższa skala)', max_per_member: null, requires_reason: true },

  // Krzyże okazjonalne — max 1.
  { name: 'Krzyż Kampanii Listopadowej - Złoty', category: 'Krzyże okazjonalne', tier_group: 'Krzyż Kampanii Listopadowej', tier_level: 'Złoty', requirement: 'Za znaczne przyczynienie się do zdobycia przez dywizjon 20. miejsca w rankingu w sezonie 2023-VI', max_per_member: 1, requires_reason: false },
  { name: 'Krzyż Kampanii Listopadowej - Srebrny', category: 'Krzyże okazjonalne', tier_group: 'Krzyż Kampanii Listopadowej', tier_level: 'Srebrny', requirement: 'Za pomoc w zdobyciu przez dywizjon 20. miejsca w rankingu w sezonie 2023-VI', max_per_member: 1, requires_reason: false },
  { name: 'Krzyż Kampanii Styczniowej', category: 'Krzyże okazjonalne', tier_group: null, tier_level: null, requirement: 'Za znaczne przyczynienie się do zdobycia przez dywizjon 50. miejsca w rankingu w sezonie 2022-I', max_per_member: 1, requires_reason: false },
  { name: 'Krzyż Kampanii Sierpniowej', category: 'Krzyże okazjonalne', tier_group: null, tier_level: null, requirement: 'Za przyczynienie się do zdobycia przez dywizjon 100. miejsca w rankingu w sezonie 2020-IV', max_per_member: 1, requires_reason: false },
  { name: 'Krzyż Turnieju PA3T 2023', category: 'Krzyże okazjonalne', tier_group: null, tier_level: null, requirement: 'Za udział w turnieju Polish Arma 3 Tournament 2023 jako część składu meczowego', max_per_member: 1, requires_reason: false },
  { name: 'Odz. pamiątkowa "Meetup 2023"', category: 'Krzyże okazjonalne', tier_group: null, tier_level: null, requirement: 'Za udział w Meetupie 7BOW 2023 w Poznaniu', max_per_member: 1, requires_reason: false },
  { name: 'Odz. pamiątkowa "Meetup 2024"', category: 'Krzyże okazjonalne', tier_group: null, tier_level: null, requirement: 'Za udział w Meetupie 7BOW 2024 w Warszawie', max_per_member: 1, requires_reason: false },
  { name: 'Odz. pamiątkowa "Meetup 2025"', category: 'Krzyże okazjonalne', tier_group: null, tier_level: null, requirement: 'Za udział w Meetupie 7BOW 2025 w Krakowie', max_per_member: 1, requires_reason: false },
  { name: 'Odz. pamiątkowa "Meetup 2026"', category: 'Krzyże okazjonalne', tier_group: null, tier_level: null, requirement: 'Za udział w Meetupie 7BOW 2026 w Gdańsku', max_per_member: 1, requires_reason: false },

  // Za bitwy dywizjonowe — unlimited, reason required.
  { name: 'Wojskowy Krzyż Zasługi', category: 'Za bitwy dywizjonowe', tier_group: null, tier_level: null, requirement: 'Za zniszczenie 8 maszyn przeciwnika w bitwie dywizjonowej przy pomocy maszyny naziemnej', max_per_member: null, requires_reason: true },
  { name: 'Lotniczy Krzyż Zasługi', category: 'Za bitwy dywizjonowe', tier_group: null, tier_level: null, requirement: 'Za zniszczenie 8 maszyn przeciwnika w bitwie dywizjonowej przy pomocy maszyny powietrznej', max_per_member: null, requires_reason: true },

  // Za wkład w sekcję Army — max 1, reason required.
  { name: 'Order Twórcy Misji 2023', category: 'Za wkład w sekcję Army', tier_group: null, tier_level: null, requirement: 'Za stworzenie najlepszych misji 2023 roku w jednej z 2 kategorii', max_per_member: 1, requires_reason: true },
  { name: 'Order Twórcy Misji 2024', category: 'Za wkład w sekcję Army', tier_group: null, tier_level: null, requirement: 'Za stworzenie najlepszych misji 2024 roku w jednej z 2 kategorii', max_per_member: 1, requires_reason: true },

  // Gwiazdy — max 1.
  { name: 'Gwiazda Lubonia', category: 'Gwiazdy', tier_group: null, tier_level: null, requirement: 'Za udział w bitwie o Luboń', max_per_member: 1, requires_reason: false },
  { name: 'Gwiazda Studzianek', category: 'Gwiazdy', tier_group: null, tier_level: null, requirement: 'Za udział w bitwie pod Studziankami', max_per_member: 1, requires_reason: false },
  { name: 'Gwiazda Egiptu', category: 'Gwiazdy', tier_group: null, tier_level: null, requirement: 'Za udział w I bitwie pod El Alamein', max_per_member: 1, requires_reason: false },
  { name: 'Gwiazda Tomaszowa', category: 'Gwiazdy', tier_group: null, tier_level: null, requirement: 'Za udział w bitwie pod Tomaszowem Lubelskim', max_per_member: 1, requires_reason: false },
  { name: 'Gwiazda El Alamein', category: 'Gwiazdy', tier_group: null, tier_level: null, requirement: 'Za udział w II bitwie pod El Alamein', max_per_member: 1, requires_reason: false },
  { name: 'Gwiazda Falaise', category: 'Gwiazdy', tier_group: null, tier_level: null, requirement: 'Za udział w kotle Falaise', max_per_member: 1, requires_reason: false },
  { name: 'Gwiazda Kurska', category: 'Gwiazdy', tier_group: null, tier_level: null, requirement: 'Za udział w bitwie na łuku kurskim', max_per_member: 1, requires_reason: false },
  { name: 'Gwiazda Lipska', category: 'Gwiazdy', tier_group: null, tier_level: null, requirement: 'Za udział w bombardowaniu Lipska', max_per_member: 1, requires_reason: false },
  { name: 'Gwiazda Renu', category: 'Gwiazdy', tier_group: null, tier_level: null, requirement: 'Za udział w przekraczaniu Renu', max_per_member: 1, requires_reason: false },
  { name: 'Gwiazda Hürtgen', category: 'Gwiazdy', tier_group: null, tier_level: null, requirement: 'Za udział w bitwie o Las Hürtgen', max_per_member: 1, requires_reason: false },
  { name: 'Gwiazda Witebska', category: 'Gwiazdy', tier_group: null, tier_level: null, requirement: 'Za udział w bitwie pod Witebskiem', max_per_member: 1, requires_reason: false },

  // Medale za długoletnią służbę — tiered, max 1.
  { name: 'Medal za Długoletnią Służbę - 5 Lat', category: 'Medale za długoletnią służbę', tier_group: 'Medal za Długoletnią Służbę', tier_level: '5 Lat', requirement: 'Za 5 lat służby', max_per_member: 1, requires_reason: false },
  { name: 'Medal za Długoletnią Służbę - 2 Lata', category: 'Medale za długoletnią służbę', tier_group: 'Medal za Długoletnią Służbę', tier_level: '2 Lata', requirement: 'Za 2 lata służby', max_per_member: 1, requires_reason: false },
  { name: 'Medal za Długoletnią Służbę - 1 Rok', category: 'Medale za długoletnią służbę', tier_group: 'Medal za Długoletnią Służbę', tier_level: '1 Rok', requirement: 'Za rok służby', max_per_member: 1, requires_reason: false },
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

  await db
    .insertInto('awards')
    .values(awards)
    .onConflict((oc) => oc.column('name').doNothing()) // if name exists, skip
    .execute()
}
