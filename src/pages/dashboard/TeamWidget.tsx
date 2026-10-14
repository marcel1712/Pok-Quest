import { SpeciesSprite } from '@/features/pokemon/components/SpeciesSprite'
import { useOwnedPokemon } from '@/features/pokemon/hooks/use-owned-pokemon'
import { useSpeciesCatalog } from '@/features/pokemon/hooks/use-species-catalog'
import { computeXpProgress } from '@/features/pokemon/xp'
import { WidgetCard } from './WidgetCard'

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
        <p className="text-slate-400">
          Seu time está vazio. Escolha um inicial ou capture um Pokémon selvagem.
        </p>
      ) : (
        <ul aria-label="Time ativo" className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {party.map((entry) => {
            const entrySpecies = species?.find((s) => s.pokedex_number === entry.pokedex_number)
            const progress = Math.round(computeXpProgress(entry.level, entry.xp).progress * 100)
            return (
              <li key={entry.id} className="flex min-w-0 flex-col items-center gap-1 text-center">
                {entrySpecies && <SpeciesSprite species={entrySpecies} size={48} />}
                <span className="w-full truncate text-xs text-slate-200">
                  {entry.nickname ?? entrySpecies?.name ?? '…'}
                </span>
                <span className="text-xs text-slate-500">Nv. {entry.level}</span>
                <div
                  role="progressbar"
                  aria-label={`XP de ${entry.nickname ?? entrySpecies?.name ?? 'Pokémon'}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                  className="h-1 w-full overflow-hidden rounded bg-slate-800"
                >
                  <div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {(boxCount > 0 || pendingEvolutions > 0) && (
        <p className="text-sm text-slate-400">
          {boxCount > 0 && `${boxCount} na box`}
          {boxCount > 0 && pendingEvolutions > 0 && ' · '}
          {pendingEvolutions > 0 && (
            <span className="text-amber-300">
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
