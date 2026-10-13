import { useEffect, useRef } from 'react'
import { didJustReachAwaitingConfirmation } from '../domain'
import type { FocusSessionPhase } from '../types'

/**
 * Optional, off-by-default sound when the planned duration is reached (RF-040 /
 * section 2.2: "Áudio: Desligado por padrão"). There's no global preferences store
 * yet (T-020/T-040), so `enabled` is local UI state on the Focus page itself — it
 * resets on reload, which is an accepted limitation until real preferences exist.
 *
 * Browser limitation worth documenting here (T-018 checklist): a backgrounded or
 * throttled tab may delay or skip this chime entirely, since `setInterval` isn't
 * guaranteed to fire while hidden. The visible countdown is unaffected — it's always
 * recomputed from timestamps (see use-session-clock.ts) — only the *sound cue* can be
 * late or silent. There is no reliable way around this from a plain web tab without a
 * Service Worker + Notifications permission, which is out of scope here.
 */
export function useCompletionChime(phase: FocusSessionPhase, enabled: boolean) {
  const audioContextRef = useRef<AudioContext | null>(null)
  const previousPhaseRef = useRef<FocusSessionPhase | undefined>(undefined)

  useEffect(() => {
    if (enabled && !audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }
  }, [enabled])

  useEffect(() => {
    const shouldChime = enabled && didJustReachAwaitingConfirmation(previousPhaseRef.current, phase)
    previousPhaseRef.current = phase
    if (!shouldChime) return

    const context = audioContextRef.current
    if (!context) return

    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = 880
    gain.gain.value = 0.15
    oscillator.connect(gain)
    gain.connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + 0.3)
  }, [phase, enabled])
}
