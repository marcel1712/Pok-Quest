import { supabase } from '@/shared/lib/supabase-client'
import type { Task, TaskStatus, TaskUpdate } from '../types'

export type TaskListFilters = {
  status?: TaskStatus
}

export async function listTasks(filters: TaskListFilters = {}): Promise<Task[]> {
  let query = supabase.from('tasks').select('*').order('due_date', { ascending: true })

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function getTaskById(id: string): Promise<Task | null> {
  const { data, error } = await supabase.from('tasks').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function createTask(
  ownerId: string,
  input: {
    title: string
    description?: string | null
    categoryId?: string | null
    difficulty: number
    dueDate?: string | null
  },
): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      owner_id: ownerId,
      title: input.title,
      description: input.description ?? null,
      category_id: input.categoryId ?? null,
      difficulty: input.difficulty,
      due_date: input.dueDate ?? null,
    })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function updateTask(id: string, patch: TaskUpdate): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data
}
