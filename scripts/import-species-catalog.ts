/**
 * Fetches a curated set of species from PokéAPI and prints SQL `INSERT` statements for
 * `species_catalog` to stdout. This is an offline, manually-run admin script — it is
 * never executed by the running app (T-024: "proibir fetch da PokéAPI em cada
 * renderização"). Review the output, then put it in a new migration via
 * `supabase migration new seed_species_catalog` and `supabase db push`.
 *
 * Run with: npx tsx scripts/import-species-catalog.ts > /tmp/species-catalog.sql
 *
 * Evolution targets/levels below are hardcoded from the actual Gen 4 games (Diamond/
 * Pearl/Platinum) rather than parsed from PokéAPI's evolution-chain graph — parsing
 * that graph is non-trivial and not worth it for this small, stable, manually-curated
 * batch. See docs/DECISIONS.md.
 */

type CuratedSpecies = {
  pokedexNumber: number
  isStarter: boolean
  evolvesTo: number | null
  evolutionMinLevel: number | null
}

const CURATED_SPECIES: CuratedSpecies[] = [
  // Sinnoh starters, full evolution lines.
  { pokedexNumber: 387, isStarter: true, evolvesTo: 388, evolutionMinLevel: 18 }, // Turtwig
  { pokedexNumber: 388, isStarter: false, evolvesTo: 389, evolutionMinLevel: 32 }, // Grotle
  { pokedexNumber: 389, isStarter: false, evolvesTo: null, evolutionMinLevel: null }, // Torterra
  { pokedexNumber: 390, isStarter: true, evolvesTo: 391, evolutionMinLevel: 14 }, // Chimchar
  { pokedexNumber: 391, isStarter: false, evolvesTo: 392, evolutionMinLevel: 36 }, // Monferno
  { pokedexNumber: 392, isStarter: false, evolvesTo: null, evolutionMinLevel: null }, // Infernape
  { pokedexNumber: 393, isStarter: true, evolvesTo: 394, evolutionMinLevel: 16 }, // Piplup
  { pokedexNumber: 394, isStarter: false, evolvesTo: 395, evolutionMinLevel: 36 }, // Prinplup
  { pokedexNumber: 395, isStarter: false, evolvesTo: null, evolutionMinLevel: null }, // Empoleon
  // Common early routes (Sinnoh Route 201/202), full evolution lines.
  { pokedexNumber: 396, isStarter: false, evolvesTo: 397, evolutionMinLevel: 14 }, // Starly
  { pokedexNumber: 397, isStarter: false, evolvesTo: 398, evolutionMinLevel: 34 }, // Staravia
  { pokedexNumber: 398, isStarter: false, evolvesTo: null, evolutionMinLevel: null }, // Staraptor
  { pokedexNumber: 399, isStarter: false, evolvesTo: 400, evolutionMinLevel: 15 }, // Bidoof
  { pokedexNumber: 400, isStarter: false, evolvesTo: null, evolutionMinLevel: null }, // Bibarel
  { pokedexNumber: 403, isStarter: false, evolvesTo: 404, evolutionMinLevel: 15 }, // Shinx
  { pokedexNumber: 404, isStarter: false, evolvesTo: 405, evolutionMinLevel: 30 }, // Luxio
  { pokedexNumber: 405, isStarter: false, evolvesTo: null, evolutionMinLevel: null }, // Luxray
]

type PokeApiPokemon = {
  name: string
  types: { type: { name: string } }[]
  sprites: {
    front_default: string | null
    other?: { ['official-artwork']?: { front_default: string | null } }
  }
}

async function fetchWithRetry(url: string, attempts = 3): Promise<PokeApiPokemon> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await fetch(url)
    if (response.ok) return response.json() as Promise<PokeApiPokemon>
    if (attempt === attempts) {
      throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
    }
    const backoffMs = attempt * 500
    await new Promise((resolve) => setTimeout(resolve, backoffMs))
  }
  throw new Error('unreachable')
}

function sqlString(value: string | null): string {
  if (value === null) return 'null'
  return `'${value.replace(/'/g, "''")}'`
}

function sqlStringArray(values: string[]): string {
  return `array[${values.map(sqlString).join(', ')}]`
}

async function main() {
  const rowBySpecies = new Map<number, string>()

  for (const species of CURATED_SPECIES) {
    const data = await fetchWithRetry(`https://pokeapi.co/api/v2/pokemon/${species.pokedexNumber}`)
    const name = data.name.charAt(0).toUpperCase() + data.name.slice(1)
    const types = data.types.map((t) => t.type.name)
    const spriteUrl = data.sprites.front_default
    const officialArtworkUrl = data.sprites.other?.['official-artwork']?.front_default ?? null

    rowBySpecies.set(
      species.pokedexNumber,
      `  (${species.pokedexNumber}, ${sqlString(name)}, ${sqlStringArray(types)}, ${sqlString(spriteUrl)}, ${sqlString(officialArtworkUrl)}, ${species.isStarter}, ${species.evolvesTo ?? 'null'}, ${species.evolutionMinLevel ?? 'null'})`,
    )

    // PokéAPI's own fair-use guidance asks for reasonable delays between requests.
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  // Insert highest pokedex_number first: in this curated set, evolves_to always
  // points to a *higher* number, so this guarantees every FK target already exists
  // when its referrer is inserted, regardless of how Postgres times the constraint
  // check within a multi-row INSERT.
  const rows = [...rowBySpecies.keys()]
    .sort((a, b) => b - a)
    .map((pokedexNumber) => rowBySpecies.get(pokedexNumber) as string)

  console.log(
    'insert into public.species_catalog (pokedex_number, name, types, sprite_url, official_artwork_url, is_starter, evolves_to_pokedex_number, evolution_min_level) values',
  )
  console.log(rows.join(',\n'))
  console.log('on conflict (pokedex_number) do update set')
  console.log('  name = excluded.name,')
  console.log('  types = excluded.types,')
  console.log('  sprite_url = excluded.sprite_url,')
  console.log('  official_artwork_url = excluded.official_artwork_url,')
  console.log('  is_starter = excluded.is_starter,')
  console.log('  evolves_to_pokedex_number = excluded.evolves_to_pokedex_number,')
  console.log('  evolution_min_level = excluded.evolution_min_level,')
  console.log('  imported_at = now();')
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
