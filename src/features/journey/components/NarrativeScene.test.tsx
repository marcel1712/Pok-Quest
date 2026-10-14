import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NarrativeScene } from './NarrativeScene'

const lines = ['Primeira fala.', 'Segunda fala.', 'Terceira fala.']

describe('NarrativeScene', () => {
  it('shows one line at a time and finishes after the last one', async () => {
    const onDone = vi.fn()
    render(<NarrativeScene title="Ginásio" lines={lines} onDone={onDone} />)

    expect(screen.getByText('Primeira fala.')).toBeInTheDocument()
    expect(screen.getByText('Ginásio · 1/3')).toBeInTheDocument()
    expect(screen.queryByText('Segunda fala.')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    await userEvent.click(screen.getByRole('button', { name: 'Próximo' }))
    expect(screen.getByText('Terceira fala.')).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Continuar' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('can be skipped from the first line', async () => {
    const onDone = vi.fn()
    render(<NarrativeScene title="Ginásio" lines={lines} onDone={onDone} />)

    await userEvent.click(screen.getByRole('button', { name: 'Pular cena' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('offers only "Continuar" for a single-line scene', () => {
    render(<NarrativeScene title="Lago" lines={['Só uma fala.']} onDone={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Continuar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pular cena' })).not.toBeInTheDocument()
  })
})
