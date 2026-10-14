import { useState } from 'react'
import { toFriendlyErrorMessage } from '@/shared/lib/supabase-error'
import { useOwnedPokemon } from '../hooks/use-owned-pokemon'
import { useSetPartyPosition, useSwapPartyPositions } from '../hooks/use-pokemon-mutations'
import { OwnedPokemonCard } from './OwnedPokemonCard'

const PARTY_SIZE = 6

export function PartyAndBox() {
  const { data: pokemon, isLoading, isError } = useOwnedPokemon()
  const setPartyPosition = useSetPartyPosition()
  const swapPartyPositions = useSwapPartyPositions()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (isLoading) return <p className="text-ink-muted">Carregando equipe…</p>

  if (isError) {
    return (
      <p role="alert" className="text-danger">
        Não foi possível carregar sua equipe.
      </p>
    )
  }

  if (!pokemon || pokemon.length === 0) {
    return <p className="text-ink-muted">Você ainda não capturou nenhum Pokémon.</p>
  }

  const party = Array.from(
    { length: PARTY_SIZE },
    (_, index) => pokemon.find((p) => p.party_position === index + 1) ?? null,
  )
  const box = pokemon.filter((p) => p.party_position === null)

  function handleSelect(id: string) {
    if (selectedId === id) {
      setSelectedId(null)
      return
    }
    if (selectedId === null) {
      setSelectedId(id)
      return
    }
    swapPartyPositions.mutate({ pokemonIdA: selectedId, pokemonIdB: id })
    setSelectedId(null)
  }

  function handleSelectEmptySlot(position: number) {
    if (selectedId === null) return
    setPartyPosition.mutate({ id: selectedId, position })
    setSelectedId(null)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-2 font-semibold text-ink">Time ativo</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {party.map((member, index) =>
            member ? (
              <OwnedPokemonCard
                key={member.id}
                pokemon={member}
                selected={member.id === selectedId}
                animated
                onClick={() => handleSelect(member.id)}
              />
            ) : (
              <button
                key={`empty-${index}`}
                type="button"
                onClick={() => handleSelectEmptySlot(index + 1)}
                className="flex h-24 items-center justify-center rounded-control border border-dashed border-line-strong text-sm text-ink-muted"
              >
                Vazio
              </button>
            ),
          )}
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-semibold text-ink">Box</h2>
        {box.length === 0 ? (
          <p className="text-ink-muted">Nenhum Pokémon no box.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {box.map((member) => (
              <OwnedPokemonCard
                key={member.id}
                pokemon={member}
                selected={member.id === selectedId}
                onClick={() => handleSelect(member.id)}
              />
            ))}
          </div>
        )}
      </div>

      {(setPartyPosition.isError || swapPartyPositions.isError) && (
        <p role="alert" className="text-sm text-danger">
          {toFriendlyErrorMessage(setPartyPosition.error ?? swapPartyPositions.error)}
        </p>
      )}

      <p className="text-xs text-ink-muted">
        Clique num Pokémon para selecionar, depois clique em outro (ou num espaço vazio) para trocar
        de posição.
      </p>
    </div>
  )
}
