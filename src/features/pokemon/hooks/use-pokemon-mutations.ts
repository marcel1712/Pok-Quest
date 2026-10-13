import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/lib/query-keys'
import {
  captureFromBattle,
  confirmEvolution,
  setPartyPosition,
  swapPartyPositions,
} from '../api/owned-pokemon-repository'

export function useCaptureFromBattle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (battleId: string) => captureFromBattle(battleId),
    onSuccess: (_pokemon, battleId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.ownedPokemon.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.captures.forBattle(battleId) })
    },
  })
}

export function useSetPartyPosition() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, position }: { id: string; position: number | null }) =>
      setPartyPosition(id, position),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.ownedPokemon.all }),
  })
}

export function useSwapPartyPositions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ pokemonIdA, pokemonIdB }: { pokemonIdA: string; pokemonIdB: string }) =>
      swapPartyPositions(pokemonIdA, pokemonIdB),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.ownedPokemon.all }),
  })
}

export function useConfirmEvolution() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ownedPokemonId: string) => confirmEvolution(ownedPokemonId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.ownedPokemon.all }),
  })
}
