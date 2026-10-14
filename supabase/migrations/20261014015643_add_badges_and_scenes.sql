-- Gyms, badges and narrative scenes (T-031).

-- Content: which badge a node awards (gyms only) and the short scenes shown before and
-- after it. Seeded like the rest of the campaign content.
alter table public.campaign_nodes
  add column badge_name text,
  add column scene_intro text[] not null default '{}',
  add column scene_outro text[] not null default '{}';

-- One badge per player per node, tied to the battle that won it. The primary key is
-- what makes it a one-time credit: a repeated battle, a second device or a retried
-- request cannot produce a second row.
create table public.badges (
  owner_id uuid not null references auth.users (id) on delete cascade,
  node_id text not null references public.campaign_nodes (id),
  battle_id uuid not null references public.battles (id),
  earned_at timestamptz not null default now(),
  primary key (owner_id, node_id)
);

alter table public.badges enable row level security;

create policy "badges_select_own"
  on public.badges for select to authenticated using (owner_id = auth.uid());

-- Written only by the trigger below.
revoke all on public.badges from public, anon, authenticated;
grant select on public.badges to authenticated;

-- Replaces the T-030 version. New: when a victory completes a node that carries a
-- badge, the badge is credited here — in the same transaction as the progress that
-- unlocks the next node, so the three (victory, badge, unlock) never disagree.
create or replace function public.record_campaign_progress_on_battle_resolved()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'resolved'
    and old.status is distinct from new.status
    and new.result = 'victory'
  then
    if new.campaign_node_id is not null then
      insert into public.campaign_node_progress as g (owner_id, node_id, victories)
        values (new.owner_id, new.campaign_node_id, 1)
        on conflict (owner_id, node_id) do update set victories = g.victories + 1;

      update public.campaign_node_progress g
        set completed_at = now()
        from public.campaign_nodes n
        where n.id = g.node_id
          and g.owner_id = new.owner_id
          and g.node_id = new.campaign_node_id
          and g.completed_at is null
          and g.victories >= n.required_victories;

      insert into public.badges (owner_id, node_id, battle_id)
        select new.owner_id, n.id, new.id
          from public.campaign_nodes n
          join public.campaign_node_progress g
            on g.node_id = n.id and g.owner_id = new.owner_id
          where n.id = new.campaign_node_id
            and n.badge_name is not null
            and g.completed_at is not null
        on conflict (owner_id, node_id) do nothing;
    end if;

    if new.encounter_id is not null then
      update public.encounters
        set consumed_at = now(), consumed_by_battle_id = new.id
        where id = new.encounter_id and consumed_at is null;
    end if;
  end if;
  return new;
end;
$$;
