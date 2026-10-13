import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EncounterCard } from './EncounterCard'

describe('EncounterCard', () => {
  it('shows the task commitment and calls onAccept with it', async () => {
    const onAccept = vi.fn()
    render(
      <EncounterCard
        encounter={{ kind: 'trainer', difficulty: 3 }}
        party={{ averageLevel: 0 }}
        commitmentType="task"
        onAccept={onAccept}
        onSkip={vi.fn()}
      />,
    )

    expect(screen.getByText('Treinador')).toBeInTheDocument()
    expect(screen.getByText(/dificuldade ≥ 3/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Aceitar encontro' }))
    expect(onAccept).toHaveBeenCalledWith({ type: 'task', minDifficulty: 3 })
  })

  it('reduces the required difficulty for a strong party', async () => {
    render(
      <EncounterCard
        encounter={{ kind: 'gymLeader', difficulty: 5 }}
        party={{ averageLevel: 50 }}
        commitmentType="focusSession"
        onAccept={vi.fn()}
        onSkip={vi.fn()}
      />,
    )

    expect(screen.getByText(/pelo menos 15 min/)).toBeInTheDocument()
  })

  it('calls onSkip without ever calling onAccept', async () => {
    const onAccept = vi.fn()
    const onSkip = vi.fn()
    render(
      <EncounterCard
        encounter={{ kind: 'wild', difficulty: 1 }}
        party={{ averageLevel: 0 }}
        commitmentType="task"
        onAccept={onAccept}
        onSkip={onSkip}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Focar sem encontro' }))
    expect(onSkip).toHaveBeenCalled()
    expect(onAccept).not.toHaveBeenCalled()
  })
})
