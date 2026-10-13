import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/shared/lib/query-keys'
import { chooseStarter, getGameProgress } from '../api/game-progress-repository'

export function useGameProgress() {
  return useQuery({
    queryKey: queryKeys.gameProgress.detail(),
    queryFn: getGameProgress,
  })
}

export function useChooseStarter() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (pokedexNumber: number) => chooseStarter(pokedexNumber),
    // Also on failure: "already chosen" (e.g. on another device) means the truth is
    // on the server, so re-read it instead of leaving the selection on screen.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.gameProgress.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.ownedPokemon.all })
    },
  })
}
