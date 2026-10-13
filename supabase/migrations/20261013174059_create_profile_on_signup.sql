-- `profiles` existed since the initial schema (T-007) but nothing ever created a row
-- for a user signed up outside the app's own flow (e.g. created directly in the
-- Supabase dashboard, as the one authorized account was). T-020 needs a guaranteed
-- profile row to store preferences (settings jsonb) against.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger create_profile_on_signup
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Backfill: every existing auth user gets a profile row now, instead of waiting for
-- their next signup (which, since public signup is disabled, will never happen again).
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;
