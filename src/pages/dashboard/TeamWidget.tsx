import { SpeciesSprite } from '@/features/pokemon/components/SpeciesSprite'
import { useOwnedPokemon } from '@/features/pokemon/hooks/use-owned-pokemon'
import { useSpeciesCatalog } from '@/features/pokemon/hooks/use-species-catalog'
import { computeXpProgress } from '@/features/pokemon/xp'
import { WidgetCard } from './WidgetCard'
import { ProgressBar } from '@/shared/ui/ProgressBar'

export function TeamWidget({ className }: { className?: string }) {
  const { data: pokemon, isLoading, error, refetch } = useOwnedPokemon()
  // One catalog request (cached for the day, shared with the Team page) instead of one
  // lookup per party member.
  const { data: species } = useSpeciesCatalog()

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
          {party.map((entry) => {
            const entrySpecies = species?.find((s) => s.pokedex_number === entry.pokedex_number)
            const progress = Math.round(computeXpProgress(entry.level, entry.xp).progress * 100)
            return (
              <li key={entry.id} className="flex min-w-0 flex-col items-center gap-1 text-center">
                {entrySpecies && <SpeciesSprite species={entrySpecies} size={96} animated />}
                <span className="w-full truncate text-xs text-ink">
                  {entry.nickname ?? entrySpecies?.name ?? '…'}
                </span>
                <span className="text-xs text-ink-muted">Nv. {entry.level}</span>
                <ProgressBar
                  label={`XP de ${entry.nickname ?? entrySpecies?.name ?? 'Pokémon'}`}
                  value={progress}
                  size="sm"
                />
              </li>
            )
          })}
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
