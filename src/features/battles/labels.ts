import type { EncounterKind } from './types'

// Plain glyphs, not real sprites — no Pokémon catalog/art pipeline exists yet (T-024).
// A missing/broken image is structurally impossible here since nothing is ever an
// <img>; this intentionally sidesteps the "sprite indisponível" failure mode rather
// than adding a fallback for it.
export const ENCOUNTER_LABELS: Record<EncounterKind, { label: string; glyph: string }> = {
  wild: { label: 'Pokémon selvagem', glyph: '🌿' },
  trainer: { label: 'Treinador', glyph: '🎒' },
  rival: { label: 'Rival', glyph: '⚡' },
  gymLeader: { label: 'Líder de Ginásio', glyph: '🏆' },
  milestone: { label: 'Marco da jornada', glyph: '📍' },
}
