import { z } from 'zod'
import { supabase } from '@/shared/lib/supabase-client'

export const loginSchema = z.object({
  email: z.string().trim().email('Informe um email válido.'),
  password: z.string().min(1, 'Informe a senha.'),
})

export type LoginInput = z.infer<typeof loginSchema>

export async function signInWithPassword(input: LoginInput) {
  const { email, password } = loginSchema.parse(input)
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
