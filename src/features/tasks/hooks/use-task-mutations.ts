import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { queryKeys } from '@/shared/lib/query-keys'
import { createTask, updateTask } from '../api/tasks-repository'
import { archiveTask, completeTask, reopenTask } from '../domain'
import type { TaskInput, TaskUpdateInput } from '../schemas'
import type { Task } from '../types'

function invalidateTasks(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  const ownerId = useAuthStore((state) => state.session?.user.id)

  return useMutation({
    mutationFn: (input: TaskInput) => {
      if (!ownerId) throw new Error('Usuário não autenticado.')
      return createTask(ownerId, input)
    },
    onSuccess: () => invalidateTasks(queryClient),
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TaskUpdateInput }) =>
      updateTask(id, {
        ...(patch.title !== undefined && { title: patch.title }),
        ...(patch.description !== undefined && { description: patch.description ?? null }),
        ...(patch.categoryId !== undefined && { category_id: patch.categoryId }),
        ...(patch.difficulty !== undefined && { difficulty: patch.difficulty }),
        ...(patch.dueDate !== undefined && { due_date: patch.dueDate }),
      }),
    onSuccess: () => invalidateTasks(queryClient),
  })
}

export function useCompleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (task: Task) => updateTask(task.id, completeTask(task)),
    onSuccess: () => invalidateTasks(queryClient),
  })
}

export function useReopenTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (task: Task) => updateTask(task.id, reopenTask(task)),
    onSuccess: () => invalidateTasks(queryClient),
  })
}

export function useArchiveTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (task: Task) => updateTask(task.id, archiveTask(task)),
    onSuccess: () => invalidateTasks(queryClient),
  })
}
