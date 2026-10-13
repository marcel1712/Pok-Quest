import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TaskForm } from './TaskForm'

describe('TaskForm', () => {
  it('rejects an empty title without calling onSubmit', async () => {
    const onSubmit = vi.fn()
    render(
      <TaskForm
        submitLabel="Adicionar"
        pendingLabel="Adicionando…"
        isSubmitting={false}
        onSubmit={onSubmit}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('O título é obrigatório.')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits the trimmed title and resets the field on success for a fresh form', async () => {
    const onSubmit = vi.fn()
    render(
      <TaskForm
        submitLabel="Adicionar"
        pendingLabel="Adicionando…"
        isSubmitting={false}
        onSubmit={onSubmit}
      />,
    )

    await userEvent.type(screen.getByPlaceholderText('O que você precisa fazer?'), '  Estudar  ')
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Estudar' }))
    expect(screen.getByPlaceholderText('O que você precisa fazer?')).toHaveValue('')
  })

  it('keeps the secondary fields hidden until "+ detalhes" is used', () => {
    render(
      <TaskForm
        submitLabel="Adicionar"
        pendingLabel="Adicionando…"
        isSubmitting={false}
        onSubmit={vi.fn()}
      />,
    )

    expect(screen.queryByLabelText('Descrição')).not.toBeInTheDocument()
  })

  it('shows initial values pre-filled and keeps details expanded when editing', () => {
    render(
      <TaskForm
        initialValues={{
          title: 'Tarefa existente',
          description: 'nota',
          difficulty: 4,
          dueDate: '2026-12-01',
        }}
        submitLabel="Salvar"
        pendingLabel="Salvando…"
        isSubmitting={false}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.getByPlaceholderText('O que você precisa fazer?')).toHaveValue('Tarefa existente')
    expect(screen.getByLabelText('Descrição')).toHaveValue('nota')
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument()
  })

  it('calls onCancel when the cancel button is clicked', async () => {
    const onCancel = vi.fn()
    render(
      <TaskForm
        initialValues={{ title: 'x' }}
        submitLabel="Salvar"
        pendingLabel="Salvando…"
        isSubmitting={false}
        onSubmit={vi.fn()}
        onCancel={onCancel}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('disables the submit button and shows the pending label while submitting', () => {
    render(
      <TaskForm
        submitLabel="Adicionar"
        pendingLabel="Adicionando…"
        isSubmitting={true}
        onSubmit={vi.fn()}
      />,
    )

    const button = screen.getByRole('button', { name: 'Adicionando…' })
    expect(button).toBeDisabled()
  })
})
