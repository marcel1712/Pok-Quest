create table public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  color text check (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create index categories_owner_id_idx on public.categories (owner_id);

create trigger set_categories_updated_at
  before update on public.categories
  for each row
  execute function public.set_updated_at();

alter table public.categories enable row level security;

create policy "categories_select_own"
  on public.categories for select
  to authenticated
  using (owner_id = auth.uid());

create policy "categories_insert_own"
  on public.categories for insert
  to authenticated
  with check (owner_id = auth.uid());

create policy "categories_update_own"
  on public.categories for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "categories_delete_own"
  on public.categories for delete
  to authenticated
  using (owner_id = auth.uid());
