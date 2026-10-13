import type { PostgrestError } from '@supabase/supabase-js'

const FRIENDLY_MESSAGES: Record<string, string> = {
  '42501': 'Você não tem permissão para fazer essa ação.',
  '23505': 'Já existe um registro com esses dados.',
  '23514': 'Os dados informados não atendem às regras esperadas.',
}

export function isPostgrestError(error: unknown): error is PostgrestError {
  return typeof error === 'object' && error !== null && 'code' in error && 'message' in error
}

/** Maps a Supabase/Postgrest error to a short message safe to show in the UI. */
export function toFriendlyErrorMessage(error: unknown): string {
  if (isPostgrestError(error)) {
    return (
      FRIENDLY_MESSAGES[error.code] ?? 'Não foi possível completar a operação. Tente novamente.'
    )
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Ocorreu um erro inesperado. Tente novamente.'
}
