import { fireEvent, render, screen } from '@testing-library/react'
import { MotionConfig } from 'motion/react'
import { describe, expect, it } from 'vitest'
import type { SpeciesCatalogEntry } from '../types'
import { SpeciesSprite } from './SpeciesSprite'

function makeSpecies(overrides: Partial<SpeciesCatalogEntry> = {}): SpeciesCatalogEntry {
  return {
    pokedex_number: 387,
    name: 'Turtwig',
    types: ['grass'],
    sprite_url: 'https://example.com/387.png',
    official_artwork_url: 'https://example.com/387-art.png',
    animated_sprite_url: null,
    is_starter: true,
    is_legendary: false,
    evolves_to_pokedex_number: 388,
    evolution_min_level: 18,
    catalog_version: 1,
    imported_at: new Date().toISOString(),
    ...overrides,
  }
}

describe('SpeciesSprite', () => {
  it('prefers the pixel-art sprite and keeps it crisp when scaled', () => {
    render(<SpeciesSprite species={makeSpecies()} />)
    const img = screen.getByRole('img', { name: 'Turtwig' })
    expect(img).toHaveAttribute('src', 'https://example.com/387.png')
    expect(img).toHaveStyle({ imageRendering: 'pixelated' })
  })

  it('uses the official artwork, scaled smoothly, when there is no sprite', () => {
    render(<SpeciesSprite species={makeSpecies({ sprite_url: null })} />)
    const img = screen.getByRole('img', { name: 'Turtwig' })
    expect(img).toHaveAttribute('src', 'https://example.com/387-art.png')
    expect(img).not.toHaveStyle({ imageRendering: 'pixelated' })
  })

  it('shows the animated sprite when asked, falling back to the static one if it fails', () => {
    render(
      <SpeciesSprite
        species={makeSpecies({ animated_sprite_url: 'https://example.com/387.gif' })}
        animated
      />,
    )
    const img = screen.getByRole('img', { name: 'Turtwig' })
    expect(img).toHaveAttribute('src', 'https://example.com/387.gif')
    expect(img).toHaveStyle({ imageRendering: 'pixelated' })

    fireEvent.error(img)
    expect(screen.getByRole('img', { name: 'Turtwig' })).toHaveAttribute(
      'src',
      'https://example.com/387.png',
    )
  })

  it('keeps the static sprite unless animation is asked for', () => {
    render(
      <SpeciesSprite
        species={makeSpecies({ animated_sprite_url: 'https://example.com/387.gif' })}
      />,
    )
    expect(screen.getByRole('img', { name: 'Turtwig' })).toHaveAttribute(
      'src',
      'https://example.com/387.png',
    )
  })

  it('does not animate when the reduce-motion preference is on', () => {
    render(
      <MotionConfig reducedMotion="always">
        <SpeciesSprite
          species={makeSpecies({ animated_sprite_url: 'https://example.com/387.gif' })}
          animated
        />
      </MotionConfig>,
    )
    expect(screen.getByRole('img', { name: 'Turtwig' })).toHaveAttribute(
      'src',
      'https://example.com/387.png',
    )
  })

  it('falls back to a generic glyph if the image fails to load', () => {
    render(<SpeciesSprite species={makeSpecies({ official_artwork_url: null })} />)
    const img = screen.getByRole('img', { name: 'Turtwig' })

    fireEvent.error(img)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('❓')).toBeInTheDocument()
  })

  it('shows the fallback glyph directly when there is no sprite URL at all', () => {
    render(
      <SpeciesSprite species={makeSpecies({ sprite_url: null, official_artwork_url: null })} />,
    )
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.getByText('❓')).toBeInTheDocument()
  })
})
