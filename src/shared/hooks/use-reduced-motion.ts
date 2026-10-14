import { createContext, useContext, useSyncExternalStore } from 'react'

/** The in-app "reduce motion" preference; provided once, by RootLayout. */
export const ReducedMotionPreferenceContext = createContext(false)

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia?.(QUERY)
  media?.addEventListener('change', onChange)
  return () => media?.removeEventListener('change', onChange)
}

/**
 * True when motion should be avoided: the in-app preference OR the operating system's
 * setting. CSS transitions/animations are already switched off globally for both (see
 * styles/index.css); this is for the things CSS cannot stop, like an animated GIF.
 */
export function useReducedMotion(): boolean {
  const preference = useContext(ReducedMotionPreferenceContext)
  const system = useSyncExternalStore(
    subscribe,
    () => window.matchMedia?.(QUERY).matches ?? false,
    () => false,
  )
  return preference || system
}
