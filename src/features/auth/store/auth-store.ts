import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'
import { supabase } from '@/shared/lib/supabase-client'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'

type AuthState = {
  session: Session | null
  status: AuthStatus
}

export const useAuthStore = create<AuthState>(() => ({
  session: null,
  status: 'loading',
}))

let listenerStarted = false

/**
 * Starts the single supabase.auth listener for the app lifetime. Safe to call
 * more than once (e.g. React Strict Mode double-invoke) — only the first call
 * registers the subscription.
 */
export function startAuthListener() {
  if (listenerStarted) return
  listenerStarted = true

  supabase.auth.getSession().then(({ data }) => {
    useAuthStore.setState({
      session: data.session,
      status: data.session ? 'authenticated' : 'unauthenticated',
    })
  })

  supabase.auth.onAuthStateChange((_event, session) => {
    useAuthStore.setState({
      session,
      status: session ? 'authenticated' : 'unauthenticated',
    })
  })
}
