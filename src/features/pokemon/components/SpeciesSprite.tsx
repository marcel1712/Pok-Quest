import { useState } from 'react'
import type { SpeciesCatalogEntry } from '../types'

/** Falls back to a generic glyph on load failure (T-024: "incluir fallback") — the
 * sprite URL points at a third-party CDN we don't control. */
export function SpeciesSprite({
  species,
  size = 64,
}: {
  species: SpeciesCatalogEntry
  size?: number
}) {
  const [failed, setFailed] = useState(false)
  const src = species.official_artwork_url ?? species.sprite_url

  if (failed || !src) {
    return (
      <span
        style={{ width: size, height: size }}
        className="flex items-center justify-center rounded bg-slate-800 text-2xl"
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
      width={size}
      height={size}
      style={{ imageRendering: 'pixelated' }}
      className="object-contain"
      onError={() => setFailed(true)}
    />
  )
}
