import { type FormEvent, useId, useState } from 'react'
import { taskInputSchema, type TaskInput } from '../schemas'

type TaskFormValues = {
  title: string
  description: string
  difficulty: number
  dueDate: string
}

const EMPTY_VALUES: TaskFormValues = { title: '', description: '', difficulty: 2, dueDate: '' }

export type TaskFormProps = {
  initialValues?: Partial<TaskFormValues>
  submitLabel: string
  pendingLabel: string
  isSubmitting: boolean
  onSubmit: (input: TaskInput) => void
  onCancel?: () => void
}

export function TaskForm({
  initialValues,
  submitLabel,
  pendingLabel,
  isSubmitting,
  onSubmit,
  onCancel,
}: TaskFormProps) {
  const [values, setValues] = useState<TaskFormValues>({ ...EMPTY_VALUES, ...initialValues })
  const [showDetails, setShowDetails] = useState(() => Boolean(initialValues))
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof TaskFormValues, string>>>({})
  const formId = useId()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = taskInputSchema.safeParse({
      title: values.title,
      description: values.description || undefined,
      difficulty: values.difficulty,
      dueDate: values.dueDate || undefined,
    })

    if (!result.success) {
      const errors: Partial<Record<keyof TaskFormValues, string>> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof TaskFormValues
        if (!errors[key]) errors[key] = issue.message
      }
      setFieldErrors(errors)
      return
    }

    setFieldErrors({})
    onSubmit(result.data)
    if (!initialValues) setValues(EMPTY_VALUES)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor={`${formId}-title`} className="sr-only">
          Título da tarefa
        </label>
        <input
          id={`${formId}-title`}
          type="text"
          placeholder="O que você precisa fazer?"
          value={values.title}
          onChange={(event) => setValues((v) => ({ ...v, title: event.target.value }))}
          className="input text-lg font-medium"
        />
        {fieldErrors.title && (
          <p role="alert" className="text-sm text-danger">
            {fieldErrors.title}
          </p>
        )}
      </div>

      {!showDetails && (
        <button
          type="button"
          onClick={() => setShowDetails(true)}
          className="self-start text-sm text-ink-muted hover:text-ink"
        >
          + detalhes (descrição, dificuldade, data)
        </button>
      )}

      {showDetails && (
        <div className="flex flex-col gap-3 rounded-control border border-line bg-surface/50 p-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${formId}-description`} className="text-sm text-ink-muted">
              Descrição
            </label>
            <textarea
              id={`${formId}-description`}
              value={values.description}
              onChange={(event) => setValues((v) => ({ ...v, description: event.target.value }))}
              rows={2}
              className="input text-sm"
            />
            {fieldErrors.description && (
              <p role="alert" className="text-sm text-danger">
                {fieldErrors.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor={`${formId}-difficulty`} className="text-sm text-ink-muted">
                Dificuldade (1-5)
              </label>
              <input
                id={`${formId}-difficulty`}
                type="number"
                min={1}
                max={5}
                value={values.difficulty}
                onChange={(event) =>
                  setValues((v) => ({ ...v, difficulty: Number(event.target.value) }))
                }
                className="input w-20 text-sm"
              />
              {fieldErrors.difficulty && (
                <p role="alert" className="text-sm text-danger">
                  {fieldErrors.difficulty}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor={`${formId}-due-date`} className="text-sm text-ink-muted">
                Data
              </label>
              <input
                id={`${formId}-due-date`}
                type="date"
                value={values.dueDate}
                onChange={(event) => setValues((v) => ({ ...v, dueDate: event.target.value }))}
                className="input text-sm"
              />
              {fieldErrors.dueDate && (
                <p role="alert" className="text-sm text-danger">
                  {fieldErrors.dueDate}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={isSubmitting} className="btn btn-primary">
          {isSubmitting ? pendingLabel : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-ghost">
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
