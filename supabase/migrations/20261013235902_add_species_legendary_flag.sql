-- Legendary and mythical species (T-030). They never appear in wild encounter tables;
-- the campaign content validator rejects them, and they stay reserved for scripted
-- story milestones.
alter table public.species_catalog
  add column is_legendary boolean not null default false;
