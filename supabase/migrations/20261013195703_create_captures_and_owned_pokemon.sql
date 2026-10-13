-- T-025: a wild encounter now refers to an actual species, decided at resolution time
-- (not client-side) so the offer survives a reload (RF-032: "sem perder captura por
-- recarga") instead of re-rolling. Trainer/rival/gymLeader/milestone encounters never
-- get one — there's nothing to capture there.
alter table public.battles
  add column wild_species_pokedex_number integer references public.species_catalog (pokedex_number);

create or replace function public.resolve_pending_battle(
  p_owner_id uuid,
  p_task_id uuid,
  p_focus_session_id uuid,
  p_fulfillment_difficulty smallint,
  p_fulfillment_minutes numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_battle public.battles;
  v_fulfilled boolean;
  v_result text;
  v_team_multiplier numeric(4, 2) := 1; -- no party-strength bonus modeled yet (T-027)
  v_base_xp numeric;
  v_xp_awarded integer;
  v_wild_species integer;
begin
  if p_task_id is not null then
    select * into v_battle from public.battles
      where task_id = p_task_id and owner_id = p_owner_id and status = 'pending';
  else
    select * into v_battle from public.battles
      where focus_session_id = p_focus_session_id and owner_id = p_owner_id and status = 'pending';
  end if;

  if v_battle is null then
    return; -- no pending commitment for this activity — nothing to resolve
  end if;

  v_fulfilled := case
    when v_battle.commitment_type = 'task' then
      p_fulfillment_difficulty >= v_battle.commitment_min_difficulty
    else
      p_fulfillment_minutes >= v_battle.commitment_min_duration_minutes
  end;

  if v_fulfilled then
    v_result := 'victory';
    v_base_xp := case
      when v_battle.commitment_type = 'task' then p_fulfillment_difficulty * 20
      else p_fulfillment_minutes * 1.5
    end;
    v_xp_awarded := round(v_base_xp * v_team_multiplier);

    if v_battle.encounter_kind = 'wild' then
      select pokedex_number into v_wild_species
        from public.species_catalog order by random() limit 1;
    end if;
  else
    v_result := 'withdrawal';
    v_xp_awarded := 0;
  end if;

  update public.battles
    set status = 'resolved', result = v_result, team_multiplier_applied = v_team_multiplier,
        resolved_at = now(), wild_species_pokedex_number = v_wild_species
    where id = v_battle.id;

  if v_xp_awarded > 0 then
    insert into public.reward_events (owner_id, source_type, source_id, reward_type, amount)
    values (v_battle.owner_id, 'battle', v_battle.id, 'xp', v_xp_awarded)
    on conflict (source_type, source_id, reward_type) do nothing;
  end if;
end;
$$;

-- `owned_pokemon`/`captures` (T-025). `party_position` doubles as the party-size cap:
-- it's constrained to 1-6 and unique per owner among non-null values, so there can
-- never be more than 6 rows with a position at once — no separate counting needed.
-- Box membership is just `party_position is null`, with no arbitrary box limit.
create table public.owned_pokemon (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  pokedex_number integer not null references public.species_catalog (pokedex_number),
  nickname text,
  level smallint not null default 5 check (level between 1 and 100),
  xp integer not null default 0 check (xp >= 0),
  party_position smallint check (party_position between 1 and 6),
  captured_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index owned_pokemon_owner_id_idx on public.owned_pokemon (owner_id);
create unique index owned_pokemon_party_position_unique
  on public.owned_pokemon (owner_id, party_position)
  where party_position is not null;

create trigger set_owned_pokemon_updated_at
  before update on public.owned_pokemon
  for each row
  execute function public.set_updated_at();

alter table public.owned_pokemon enable row level security;

create policy "owned_pokemon_select_own"
  on public.owned_pokemon for select
  to authenticated
  using (owner_id = auth.uid());

-- No INSERT policy: a new owned_pokemon row is only ever created by
-- `capture_from_battle` below (SECURITY DEFINER), never directly by the client — that's
-- what stops someone from just inserting themselves a free, fully-grown Pokémon.
create policy "owned_pokemon_update_own"
  on public.owned_pokemon for update
  to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- One capture per battle (RF-032: "estado único"). `captures` is an audit trail, not a
-- second source of truth — `owned_pokemon` is what the UI reads for team/box.
create table public.captures (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  battle_id uuid not null references public.battles (id) on delete cascade,
  pokedex_number integer not null references public.species_catalog (pokedex_number),
  owned_pokemon_id uuid references public.owned_pokemon (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (battle_id)
);

create index captures_owner_id_idx on public.captures (owner_id);

alter table public.captures enable row level security;

create policy "captures_select_own"
  on public.captures for select
  to authenticated
  using (owner_id = auth.uid());

-- No write policy for `authenticated` — only `capture_from_battle` writes here.

-- Validates eligibility itself (own battle, resolved victory, wild, not already
-- captured) instead of trusting any client-supplied species/level — the only input is
-- a battle id, and everything credited is derived from that trusted row.
create or replace function public.capture_from_battle(p_battle_id uuid)
returns public.owned_pokemon
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_battle public.battles;
  v_pokemon public.owned_pokemon;
begin
  select * into v_battle from public.battles where id = p_battle_id and owner_id = auth.uid();
  if v_battle is null then
    raise exception 'Batalha não encontrada.';
  end if;

  if v_battle.status != 'resolved' or v_battle.result != 'victory' then
    raise exception 'Só é possível capturar depois de uma vitória confirmada.';
  end if;

  if v_battle.encounter_kind != 'wild' or v_battle.wild_species_pokedex_number is null then
    raise exception 'Esse encontro não tem um Pokémon selvagem para capturar.';
  end if;

  insert into public.owned_pokemon (owner_id, pokedex_number)
  values (v_battle.owner_id, v_battle.wild_species_pokedex_number)
  returning * into v_pokemon;

  insert into public.captures (owner_id, battle_id, pokedex_number, owned_pokemon_id)
  values (v_battle.owner_id, p_battle_id, v_battle.wild_species_pokedex_number, v_pokemon.id);

  return v_pokemon;
exception
  when unique_violation then
    -- Retry/duplicate request race on the same battle: return what the winning
    -- request already created instead of erroring or creating a second Pokémon.
    select op.* into v_pokemon
      from public.captures c
      join public.owned_pokemon op on op.id = c.owned_pokemon_id
      where c.battle_id = p_battle_id;
    return v_pokemon;
end;
$$;

revoke all on function public.capture_from_battle(uuid) from anon;

-- Exchanges two of the caller's own Pokémon's party positions atomically (so slot 3
-- is never briefly held by both at once, which the unique index would reject). Plain
-- SECURITY INVOKER: RLS on owned_pokemon already confines every statement here to the
-- caller's own rows, so no elevated privilege is needed.
create or replace function public.swap_party_positions(p_pokemon_a uuid, p_pokemon_b uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_pos_a smallint;
  v_pos_b smallint;
begin
  select party_position into v_pos_a from public.owned_pokemon
    where id = p_pokemon_a and owner_id = auth.uid();
  select party_position into v_pos_b from public.owned_pokemon
    where id = p_pokemon_b and owner_id = auth.uid();

  update public.owned_pokemon set party_position = null where id = p_pokemon_a and owner_id = auth.uid();
  update public.owned_pokemon set party_position = v_pos_a where id = p_pokemon_b and owner_id = auth.uid();
  update public.owned_pokemon set party_position = v_pos_b where id = p_pokemon_a and owner_id = auth.uid();
end;
$$;

revoke all on function public.swap_party_positions(uuid, uuid) from anon;
