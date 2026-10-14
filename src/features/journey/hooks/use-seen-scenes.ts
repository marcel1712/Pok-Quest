import { useCallback, useState } from 'react'

const STORAGE_KEY = 'pokequest.seen-scenes'

function readSeen(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === 'string') : []
  } catch {
    return []
  }
}

/**
 * Which intro scenes this device has already shown. Deliberately local (not in the
 * database): it only decides whether to auto-play a scene, and every scene can be read
 * again from the Journey page — the worst case on a new device is seeing one twice.
 */
export function useSeenScenes() {
  const [seen, setSeen] = useState<string[]>(readSeen)

  const markSeen = useCallback((nodeId: string) => {
    setSeen((current) => {
      if (current.includes(nodeId)) return current
      const next = [...current, nodeId]
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Storage unavailable (private mode, quota): the scene just replays next time.
      }
      return next
    })
  }, [])

  return { hasSeen: (nodeId: string) => seen.includes(nodeId), markSeen }
}
