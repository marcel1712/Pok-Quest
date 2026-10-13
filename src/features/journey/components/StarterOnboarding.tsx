import { useState } from 'react'
import { SpeciesSprite } from '@/features/pokemon/components/SpeciesSprite'
import { useSpeciesCatalog } from '@/features/pokemon/hooks/use-species-catalog'
import { isPostgrestError, toFriendlyErrorMessage } from '@/shared/lib/supabase-error'
import { useChooseStarter, useGameProgress } from '../hooks/use-starter'

const TYPE_LABELS: Record<string, string> = {
  grass: 'Planta',
  fire: 'Fogo',
  water: 'Água',
}

/**
 * Shown on top of a page until the starter is chosen. Renders nothing while loading,
 * on error or once chosen — it is an invitation, never a gate: tasks and focus work
 * the same without a starter.
 */
export function StarterOnboarding() {
  const { data: gameProgress, isSuccess } = useGameProgress()
  const { data: species } = useSpeciesCatalog()
  const chooseStarter = useChooseStarter()
  const [selected, setSelected] = useState<number | null>(null)

  const starters = species?.filter((entry) => entry.is_starter) ?? []
  if (!isSuccess || gameProgress || starters.length === 0) return null

  const selectedStarter = starters.find((entry) => entry.pokedex_number === selected)
  // 23505 = already chosen elsewhere; the refetch in the mutation hides this card.
  const error =
    chooseStarter.error &&
    !(isPostgrestError(chooseStarter.error) && chooseStarter.error.code === '23505')
      ? chooseStarter.error
      : null

  return (
    <div className="flex flex-col gap-4 rounded border border-emerald-500/60 p-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-100">Escolha seu Pokémon inicial</h2>
        <p className="mt-1 text-sm text-slate-400">
          Sua jornada por Sinnoh começa com um parceiro. Ele ganha experiência a cada encontro que
          você vence com tarefas e sessões de foco. A escolha é definitiva.
        </p>
      </div>

      <div role="radiogroup" aria-label="Pokémon inicial" className="grid gap-3 sm:grid-cols-3">
        {starters.map((entry) => {
          const isSelected = entry.pokedex_number === selected
          return (
            <button
              key={entry.pokedex_number}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={chooseStarter.isPending}
              onClick={() => setSelected(entry.pokedex_number)}
              className={`flex flex-col items-center gap-1 rounded border p-3 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                isSelected ? 'border-emerald-400 bg-emerald-500/10' : 'border-slate-700'
              }`}
            >
              <SpeciesSprite species={entry} size={96} />
              <span className="font-semibold text-slate-100">{entry.name}</span>
              <span className="text-xs text-slate-400">
                Tipo {entry.types.map((type) => TYPE_LABELS[type] ?? type).join(' / ')}
              </span>
              {entry.evolution_min_level && (
                <span className="text-xs text-slate-500">
                  Evolui no nível {entry.evolution_min_level}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400">
          {toFriendlyErrorMessage(error)}
        </p>
      )}

      <button
        type="button"
        disabled={!selectedStarter || chooseStarter.isPending}
        onClick={() => selectedStarter && chooseStarter.mutate(selectedStarter.pokedex_number)}
        className="self-start rounded bg-emerald-500 px-4 py-2 font-semibold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-40"
      >
        {chooseStarter.isPending
          ? 'Confirmando…'
          : selectedStarter
            ? `Começar com ${selectedStarter.name}`
            : 'Selecione um Pokémon'}
      </button>
    </div>
  )
}
