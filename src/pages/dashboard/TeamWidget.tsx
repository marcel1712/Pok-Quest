import { SpeciesSprite } from '@/features/pokemon/components/SpeciesSprite'
import { useOwnedPokemon } from '@/features/pokemon/hooks/use-owned-pokemon'
import { useSpeciesByPokedexNumber } from '@/features/pokemon/hooks/use-species-catalog'
import type { OwnedPokemon } from '@/features/pokemon/types'
import { computeXpProgress } from '@/features/pokemon/xp'
import { WidgetCard } from './WidgetCard'
import { ProgressBar } from '@/shared/ui/ProgressBar'

function TeamMember({ pokemon }: { pokemon: OwnedPokemon }) {
  // Lookups made in the same tick are batched by the repository into one request, and
  // are free when the Team page already cached the catalog.
  const { data: species } = useSpeciesByPokedexNumber(pokemon.pokedex_number)
  const name = pokemon.nickname ?? species?.name ?? '…'
  const progress = Math.round(computeXpProgress(pokemon.level, pokemon.xp).progress * 100)

  return (
    <li className="flex min-w-0 flex-col items-center gap-1 text-center">
      {species && <SpeciesSprite species={species} size={96} animated />}
      <span className="w-full truncate text-xs text-ink">{name}</span>
      <span className="text-xs text-ink-muted">Nv. {pokemon.level}</span>
      <ProgressBar
        label={`XP de ${pokemon.nickname ?? species?.name ?? 'Pokémon'}`}
        value={progress}
        size="sm"
      />
    </li>
  )
}

export function TeamWidget({ className }: { className?: string }) {
  const { data: pokemon, isLoading, error, refetch } = useOwnedPokemon()
  const party = (pokemon ?? [])
    .filter((entry) => entry.party_position !== null)
    .sort((a, b) => (a.party_position ?? 0) - (b.party_position ?? 0))
  const boxCount = (pokemon?.length ?? 0) - party.length
  const pendingEvolutions = (pokemon ?? []).filter(
    (entry) => entry.pending_evolution_to_pokedex_number,
  ).length

  return (
    <WidgetCard
      className={className}
      title="Equipe"
      linkTo="/team"
      linkLabel="Gerenciar"
      isLoading={isLoading}
      error={error}
      onRetry={() => refetch()}
    >
      {party.length === 0 ? (
        <p className="text-ink-muted">
          Seu time está vazio. Escolha um inicial ou capture um Pokémon selvagem.
        </p>
      ) : (
        <ul
          aria-label="Time ativo"
          className="grid grid-cols-3 gap-x-1 gap-y-3 sm:grid-cols-6 sm:gap-x-2 lg:grid-cols-3"
        >
          {party.map((entry) => (
            <TeamMember key={entry.id} pokemon={entry} />
          ))}
        </ul>
      )}

      {(boxCount > 0 || pendingEvolutions > 0) && (
        <p className="text-sm text-ink-muted">
          {boxCount > 0 && `${boxCount} na box`}
          {boxCount > 0 && pendingEvolutions > 0 && ' · '}
          {pendingEvolutions > 0 && (
            <span className="text-warning">
              {pendingEvolutions === 1
                ? '1 evolução esperando confirmação'
                : `${pendingEvolutions} evoluções esperando confirmação`}
            </span>
          )}
        </p>
      )}
    </WidgetCard>
  )
}
