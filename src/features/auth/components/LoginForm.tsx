import { useMutation } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { signInWithPassword } from '@/features/auth/api/auth'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const mutation = useMutation({
    mutationFn: signInWithPassword,
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    mutation.mutate({ email, password })
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm text-slate-300">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm text-slate-300">
          Senha
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-slate-100 outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
        />
      </div>

      {mutation.isError && (
        <p role="alert" className="text-sm text-red-400">
          Email ou senha incorretos.
        </p>
      )}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded bg-emerald-500 px-4 py-2 font-semibold text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:opacity-60"
      >
        {mutation.isPending ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
