create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text check (char_length(description) <= 5000),
  category_id uuid references public.categories (id) on delete set null,
  difficulty smallint not null default 2 check (difficulty between 1 and 5),
  due_date date,
  status text not null default 'pending' check (status in ('pending', 'completed', 'archived')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- `completed_at` must be set if and only if the task is completed, keeping history consistent
  -- with RF-006/RF-009 (reopen clears it, duplicate completion can't fork the two apart).
  check ((status = 'completed') = (completed_at is not null))
);

create index tasks_owner_id_idx on public.tasks (owner_id);
create index tasks_owner_status_idx on public.tasks (owner_id, status);
create index tasks_owner_due_date_idx on public.tasks (owner_id, due_date);

create trigger set_tasks_updated_at
  before update on public.tasks
  for each row
  execute function public.set_updated_at();

alter table public.tasks enable row level security;

create policy "tasks_select_own"
  on public.tasks for select
  to authenticated
  using (owner_id = auth.uid());

create policy "tasks_insert_own"
  on public.tasks for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "tasks_update_own"
  on public.tasks for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "tasks_delete_own"
  on public.tasks for delete
  to authenticated
  using (owner_id = auth.uid());
