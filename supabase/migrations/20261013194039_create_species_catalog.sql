-- Shared reference data (not per-user): species the game currently knows about.
-- Populated only by reviewed migrations generated from scripts/import-species-catalog.ts
-- (see docs/DECISIONS.md) — never written by the running app, and never fetched from
-- PokéAPI at runtime (T-024: "proibir fetch da PokéAPI em cada renderização").
create table public.species_catalog (
  pokedex_number integer primary key,
  name text not null,
  types text[] not null check (array_length(types, 1) between 1 and 2),
  sprite_url text,
  official_artwork_url text,
  is_starter boolean not null default false,
  evolves_to_pokedex_number integer references public.species_catalog (pokedex_number),
  evolution_min_level smallint,
  catalog_version integer not null default 1,
  imported_at timestamptz not null default now()
);

alter table public.species_catalog enable row level security;

-- Shared read access: every authenticated user (i.e. the one authorized account) can
-- read the whole catalog. No INSERT/UPDATE/DELETE policy — see the table comment.
create policy "species_catalog_select_all"
  on public.species_catalog for select
  to authenticated
  using (true);
