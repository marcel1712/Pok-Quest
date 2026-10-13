import { describe, expect, it } from 'vitest'
import { toFriendlyErrorMessage } from './supabase-error'

describe('toFriendlyErrorMessage', () => {
  it('maps known Postgrest RLS error codes to a friendly message', () => {
    const error = { code: '42501', message: 'new row violates row-level security policy' }
    expect(toFriendlyErrorMessage(error)).toBe('Você não tem permissão para fazer essa ação.')
  })

  it('maps unknown Postgrest codes to a generic retry message', () => {
    const error = { code: '99999', message: 'something odd' }
    expect(toFriendlyErrorMessage(error)).toBe(
      'Não foi possível completar a operação. Tente novamente.',
    )
  })

  it('falls back to the error message for plain Error instances', () => {
    expect(toFriendlyErrorMessage(new Error('network down'))).toBe('network down')
  })

  it('falls back to a generic message for unknown throw values', () => {
    expect(toFriendlyErrorMessage('oops')).toBe('Ocorreu um erro inesperado. Tente novamente.')
  })
})
