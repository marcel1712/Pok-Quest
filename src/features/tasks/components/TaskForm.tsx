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
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-lg font-medium text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        />
        {fieldErrors.title && (
          <p role="alert" className="text-sm text-red-400">
            {fieldErrors.title}
          </p>
        )}
      </div>

      {!showDetails && (
        <button
          type="button"
          onClick={() => setShowDetails(true)}
          className="self-start text-sm text-slate-400 hover:text-slate-200"
        >
          + detalhes (descrição, dificuldade, data)
        </button>
      )}

      {showDetails && (
        <div className="flex flex-col gap-3 rounded border border-slate-800 bg-slate-900/50 p-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${formId}-description`} className="text-sm text-slate-400">
              Descrição
            </label>
            <textarea
              id={`${formId}-description`}
              value={values.description}
              onChange={(event) => setValues((v) => ({ ...v, description: event.target.value }))}
              rows={2}
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            />
            {fieldErrors.description && (
              <p role="alert" className="text-sm text-red-400">
                {fieldErrors.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor={`${formId}-difficulty`} className="text-sm text-slate-400">
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
                className="w-20 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              />
              {fieldErrors.difficulty && (
                <p role="alert" className="text-sm text-red-400">
                  {fieldErrors.difficulty}
                </p>
              )}
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor={`${formId}-due-date`} className="text-sm text-slate-400">
                Data
              </label>
              <input
                id={`${formId}-due-date`}
                type="date"
                value={values.dueDate}
                onChange={(event) => setValues((v) => ({ ...v, dueDate: event.target.value }))}
                className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              />
              {fieldErrors.dueDate && (
                <p role="alert" className="text-sm text-red-400">
                  {fieldErrors.dueDate}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-emerald-500 px-4 py-2 font-semibold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-60"
        >
          {isSubmitting ? pendingLabel : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded px-4 py-2 text-slate-400 hover:text-slate-200"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
