import type { Tables, TablesInsert, TablesUpdate } from '@/shared/types/database'

export type Task = Tables<'tasks'>
export type TaskInsert = TablesInsert<'tasks'>
export type TaskUpdate = TablesUpdate<'tasks'>

export type TaskStatus = 'pending' | 'completed' | 'archived'
