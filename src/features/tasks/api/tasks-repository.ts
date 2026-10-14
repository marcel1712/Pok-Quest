import { supabase } from '@/shared/lib/supabase-client'
import { TASK_HISTORY_LIMIT } from '../limits'
import type { Task, TaskStatus, TaskUpdate } from '../types'

export type TaskListFilters = {
  status?: TaskStatus
}

export async function listTasks(filters: TaskListFilters = {}): Promise<Task[]> {
  const isHistory = filters.status === 'completed' || filters.status === 'archived'

  // Pending tasks are a working list: all of them, by due date. History is unbounded,
  // so it is capped and shown newest first (T-034).
  let query = isHistory
    ? supabase
        .from('tasks')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(TASK_HISTORY_LIMIT)
    : supabase.from('tasks').select('*').order('due_date', { ascending: true })

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
