-- Starter selection (T-029). One row per player; the primary key is what makes the
-- choice a one-time operation — a second attempt (double click, second device, retry
-- after a dropped connection) hits the key and changes nothing.
create table public.game_progress (
  owner_id uuid primary key references auth.users (id) on delete cascade,
  starter_pokedex_number integer not null references public.species_catalog (pokedex_number),
  starter_owned_pokemon_id uuid references public.owned_pokemon (id) on delete set null,
  starter_chosen_at timestamptz not null default now()
);

alter table public.game_progress enable row level security;

create policy "game_progress_select_own"
  on public.game_progress for select
  to authenticated
  using (owner_id = auth.uid());

-- Written only by choose_starter below.
revoke all on public.game_progress from public, anon, authenticated;
grant select on public.game_progress to authenticated;

-- The only input is which of the catalog's starters the player wants; owner, level,
-- xp and party slot are all decided here. Recording the choice and creating the
-- Pokémon happen in one transaction: there is never a recorded choice without its
-- Pokémon, nor a starter Pokémon without a recorded choice.
create or replace function public.choose_starter(p_pokedex_number integer)
returns public.owned_pokemon
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_id uuid := auth.uid();
  v_party_position smallint;
  v_pokemon public.owned_pokemon;
begin
  if v_owner_id is null then
    raise exception 'Usuário não autenticado.' using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from public.species_catalog
      where pokedex_number = p_pokedex_number and is_starter
  ) then
    raise exception 'Essa espécie não é um Pokémon inicial.' using errcode = 'check_violation';
  end if;

  -- Claim the one-time choice first: a concurrent second call blocks on this key and
  -- then fails with unique_violation, before any Pokémon is created.
  insert into public.game_progress (owner_id, starter_pokedex_number)
    values (v_owner_id, p_pokedex_number);

  -- First free party slot (always 1 for a new player); the box if the party is full.
  select slot into v_party_position
    from generate_series(1, 6) as slot
    where not exists (
      select 1 from public.owned_pokemon
        where owner_id = v_owner_id and party_position = slot
    )
    order by slot
    limit 1;

  insert into public.owned_pokemon (owner_id, pokedex_number, level, xp, party_position)
    values (v_owner_id, p_pokedex_number, 5, public.total_xp_for_level(5), v_party_position)
    returning * into v_pokemon;

  update public.game_progress
    set starter_owned_pokemon_id = v_pokemon.id
    where owner_id = v_owner_id;

  return v_pokemon;
end;
$$;

revoke all on function public.choose_starter(integer) from public, anon;
grant execute on function public.choose_starter(integer) to authenticated;
