import { fireEvent, render, screen } from '@testing-library/react'
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
  it('renders an image using the official artwork URL when available', () => {
    render(<SpeciesSprite species={makeSpecies()} />)
    const img = screen.getByRole('img', { name: 'Turtwig' })
    expect(img).toHaveAttribute('src', 'https://example.com/387-art.png')
  })

  it('falls back to a generic glyph if the image fails to load', () => {
    render(<SpeciesSprite species={makeSpecies()} />)
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
