/**
 * Fetches the whole Pokémon Platinum regional Pokédex (210 species) from PokéAPI and
 * prints an idempotent SQL seed for `species_catalog` to stdout. Offline, manually-run
 * admin script — never executed by the running app (T-024: "proibir fetch da PokéAPI em
 * cada renderização"). Review the output, then put it in a new migration
 * (`npx supabase migration new seed_species_catalog_...`) and `npm run db:push`.
 *
 * Run with: npm run catalog:import > some-file.sql   (takes a couple of minutes)
 *
 * Also rewrites src/features/journey/content/species-index.ts, which the campaign
 * content validator uses to check wild-encounter tables against this catalog.
 *
 * Evolution rules, since this game only knows "evolves at level N":
 *   - A species evolves into the first evolution PokéAPI lists that is also in this
 *     Pokédex (so branching lines such as Eevee's keep a single, fixed target).
 *   - Level-up evolutions keep their real level.
 *   - Evolutions the games gate on something else (stone, trade, friendship, held
 *     item, place, move) get a substitute level: NON_LEVEL_FIRST_STAGE for a species
 *     at the base of its line, otherwise NON_LEVEL_LATER_STAGE — and never less than
 *     LATER_STAGE_GAP levels after the evolution that produced it.
 * See docs/GAME_RULES.md.
 */

import { writeFileSync } from 'node:fs'

const SPECIES_INDEX_PATH = 'src/features/journey/content/species-index.ts'
const POKEDEX_URL = 'https://pokeapi.co/api/v2/pokedex/extended-sinnoh'
const STARTERS = new Set([387, 390, 393])
const NON_LEVEL_FIRST_STAGE = 25
const NON_LEVEL_LATER_STAGE = 40
const LATER_STAGE_GAP = 10
const REQUEST_DELAY_MS = 80

type NamedResource = { name: string; url: string }

type PokeApiPokedex = { pokemon_entries: { pokemon_species: NamedResource }[] }

type PokeApiSpecies = {
  id: number
  is_legendary: boolean
  is_mythical: boolean
  names: { name: string; language: { name: string } }[]
  evolution_chain: { url: string }
}

type PokeApiPokemon = {
  types: { type: { name: string } }[]
  sprites: {
    front_default: string | null
    other?: { ['official-artwork']?: { front_default: string | null } }
  }
}

type ChainLink = {
  species: NamedResource
  evolution_details: { min_level: number | null }[]
  evolves_to: ChainLink[]
}

type PokeApiEvolutionChain = { chain: ChainLink }

type Evolution = { evolvesTo: number; minLevel: number }

async function fetchJson<T>(url: string, attempts = 4): Promise<T> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await fetch(url).catch(() => null)
    if (response?.ok) {
      // PokéAPI's fair-use guidance asks for reasonable pacing between requests.
      await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS))
      return response.json() as Promise<T>
    }
    if (attempt === attempts) {
      throw new Error(`Failed to fetch ${url}: ${response?.status ?? 'network error'}`)
    }
    await new Promise((resolve) => setTimeout(resolve, attempt * 500))
  }
  throw new Error('unreachable')
}

function idFromUrl(url: string): number {
  const match = /\/(\d+)\/?$/.exec(url)
  if (!match?.[1]) throw new Error(`No id in ${url}`)
  return Number(match[1])
}

function sqlString(value: string | null): string {
  if (value === null) return 'null'
  return `'${value.replace(/'/g, "''")}'`
}

/** Walks one evolution line, recording each in-Pokédex species' single evolution. */
function collectEvolutions(
  link: ChainLink,
  inPokedex: Set<number>,
  evolutions: Map<number, Evolution>,
  isBase: boolean,
  levelThatProducedThis: number,
) {
  const from = idFromUrl(link.species.url)
  const target = link.evolves_to.find((next) => inPokedex.has(idFromUrl(next.species.url)))
  let nextLevel = levelThatProducedThis

  if (target && inPokedex.has(from)) {
    const realLevel = target.evolution_details.find((detail) => detail.min_level)?.min_level
    const minLevel =
      realLevel ??
      (isBase
        ? NON_LEVEL_FIRST_STAGE
        : Math.max(NON_LEVEL_LATER_STAGE, levelThatProducedThis + LATER_STAGE_GAP))
    evolutions.set(from, { evolvesTo: idFromUrl(target.species.url), minLevel })
    nextLevel = minLevel
  }

  for (const next of link.evolves_to) {
    const followsChosenTarget = next === target
    collectEvolutions(
      next,
      inPokedex,
      evolutions,
      false,
      followsChosenTarget ? nextLevel : levelThatProducedThis,
    )
  }
}

async function main() {
  const pokedex = await fetchJson<PokeApiPokedex>(POKEDEX_URL)
  const numbers = pokedex.pokemon_entries
    .map((entry) => idFromUrl(entry.pokemon_species.url))
    .sort((a, b) => a - b)
  const inPokedex = new Set(numbers)

  const speciesByNumber = new Map<number, PokeApiSpecies>()
  const pokemonByNumber = new Map<number, PokeApiPokemon>()
  for (const number of numbers) {
    speciesByNumber.set(
      number,
      await fetchJson<PokeApiSpecies>(`https://pokeapi.co/api/v2/pokemon-species/${number}`),
    )
    pokemonByNumber.set(
      number,
      await fetchJson<PokeApiPokemon>(`https://pokeapi.co/api/v2/pokemon/${number}`),
    )
    console.error(`fetched ${number} (${speciesByNumber.size}/${numbers.length})`)
  }

  const evolutions = new Map<number, Evolution>()
  const chainUrls = new Set([...speciesByNumber.values()].map((s) => s.evolution_chain.url))
  for (const url of chainUrls) {
    const { chain } = await fetchJson<PokeApiEvolutionChain>(url)
    collectEvolutions(chain, inPokedex, evolutions, true, 0)
  }

  const rows = numbers.map((number) => {
    const species = speciesByNumber.get(number) as PokeApiSpecies
    const pokemon = pokemonByNumber.get(number) as PokeApiPokemon
    const name = species.names.find((entry) => entry.language.name === 'en')?.name
    if (!name) throw new Error(`No English name for ${number}`)
    const evolution = evolutions.get(number)

    return `  (${[
      number,
      sqlString(name),
      `array[${pokemon.types.map((t) => sqlString(t.type.name)).join(', ')}]`,
      sqlString(pokemon.sprites.front_default),
      sqlString(pokemon.sprites.other?.['official-artwork']?.front_default ?? null),
      STARTERS.has(number),
      species.is_legendary || species.is_mythical,
      evolution?.evolvesTo ?? 'null',
      evolution?.minLevel ?? 'null',
    ].join(', ')})`
  })

  const indexLines = numbers.map((number) => {
    const species = speciesByNumber.get(number) as PokeApiSpecies
    const name = species.names.find((entry) => entry.language.name === 'en')?.name ?? ''
    const legendary = species.is_legendary || species.is_mythical
    return `  ${number}: { name: ${JSON.stringify(name)}, legendary: ${legendary} },`
  })
  // Double-quoted names here; `npm run format` normalizes the file to the repo style.
  writeFileSync(
    SPECIES_INDEX_PATH,
    [
      '// Generated by `npm run catalog:import` together with the species_catalog seed. Do not',
      '// edit by hand. Lets campaign content be validated against the catalog without a',
      '// database round-trip.',
      'export const SPECIES_INDEX: Record<number, { name: string; legendary: boolean }> = {',
      ...indexLines,
      '}',
      '',
    ].join('\n'),
  )

  // One statement on purpose: the self-referencing evolves_to foreign key is checked
  // at the end of the statement, so row order does not matter (Budew #406 evolves into
  // Roselia #315, for instance).
  console.log(
    `-- Generated by \`npm run catalog:import\` from PokéAPI's "extended-sinnoh" Pokédex\n` +
      `-- (${numbers.length} species). Do not edit by hand: rerun the script into a new migration.\n` +
      'insert into public.species_catalog (pokedex_number, name, types, sprite_url, official_artwork_url, is_starter, is_legendary, evolves_to_pokedex_number, evolution_min_level) values',
  )
  console.log(rows.join(',\n'))
  console.log(`on conflict (pokedex_number) do update set
  name = excluded.name,
  types = excluded.types,
  sprite_url = excluded.sprite_url,
  official_artwork_url = excluded.official_artwork_url,
  is_starter = excluded.is_starter,
  is_legendary = excluded.is_legendary,
  evolves_to_pokedex_number = excluded.evolves_to_pokedex_number,
  evolution_min_level = excluded.evolution_min_level,
  catalog_version = 2,
  imported_at = now();`)
}

main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
