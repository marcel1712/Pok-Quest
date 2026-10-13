import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/features/auth/store/auth-store'
import { queryKeys } from '@/shared/lib/query-keys'
import { createTask, updateTask } from '../api/tasks-repository'
import { archiveTask, completeTask, reopenTask } from '../domain'
import type { TaskInput, TaskUpdateInput } from '../schemas'
import type { Task, TaskUpdate } from '../types'

function invalidateTasks(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
}

type TaskListSnapshot = ReturnType<QueryClient['getQueriesData']>

function snapshotTaskLists(queryClient: QueryClient): TaskListSnapshot {
  return queryClient.getQueriesData({ queryKey: queryKeys.tasks.all })
}

function restoreTaskLists(queryClient: QueryClient, snapshot: TaskListSnapshot) {
  for (const [key, data] of snapshot) {
    queryClient.setQueryData(key, data)
  }
}

function patchTaskInLists(queryClient: QueryClient, taskId: string, patch: TaskUpdate) {
  queryClient.setQueriesData<Task[]>({ queryKey: queryKeys.tasks.all }, (old) =>
    old?.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
  )
}

/** Shared optimistic-update wiring for the single-field status transitions below. */
function useOptimisticStatusMutation(computePatch: (task: Task) => TaskUpdate) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (task: Task) => updateTask(task.id, computePatch(task)),
    onMutate: async (task: Task) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.tasks.all })
      const snapshot = snapshotTaskLists(queryClient)
      patchTaskInLists(queryClient, task.id, computePatch(task))
      return { snapshot }
    },
    onError: (_error, _task, context) => {
      if (context) restoreTaskLists(queryClient, context.snapshot)
    },
    onSettled: () => invalidateTasks(queryClient),
  })
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
  return useOptimisticStatusMutation(completeTask)
}

export function useReopenTask() {
  return useOptimisticStatusMutation(reopenTask)
}

export function useArchiveTask() {
  return useOptimisticStatusMutation(archiveTask)
}
