import { useReducedMotionConfig } from 'motion/react'
import { useState } from 'react'
import type { SpeciesCatalogEntry } from '../types'

/**
 * Pixel-art sprite, scaled with nearest-neighbour so it stays crisp instead of blurring.
 * With `animated`, the moving GIF is tried first — unless motion is reduced (in-app
 * preference or OS setting), since a GIF cannot be paused by CSS. Each source that
 * fails to load falls through to the next: animated GIF, static sprite, official
 * artwork (a painting, so scaled smoothly), then a generic glyph (T-024: "incluir
 * fallback") — the images come from a third-party CDN we don't control.
 */
export function SpeciesSprite({
  species,
  size = 64,
  animated = false,
}: {
  species: SpeciesCatalogEntry
  size?: number
  animated?: boolean
}) {
  const reduceMotion = useReducedMotionConfig()
  const [failedSources, setFailedSources] = useState<string[]>([])

  const candidates = [
    animated && !reduceMotion ? species.animated_sprite_url : null,
    species.sprite_url,
    species.official_artwork_url,
  ].filter((url): url is string => Boolean(url))
  const src = candidates.find((url) => !failedSources.includes(url))

  if (!src) {
    return (
      <span
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded-control bg-surface-raised text-2xl"
        aria-hidden="true"
      >
        ❓
      </span>
    )
  }

  return (
    <img
      src={src}
      alt={species.name}
      loading="lazy"
      width={size}
      height={size}
      // Explicit box: the GIFs are not square, and Tailwind's reset (img { height: auto })
      // would otherwise let each one pick its own height and break the row alignment.
      style={{
        width: size,
        height: size,
        ...(src === species.official_artwork_url ? {} : { imageRendering: 'pixelated' as const }),
      }}
      className="shrink-0 object-contain"
      onError={() => setFailedSources((current) => [...current, src])}
    />
  )
}
