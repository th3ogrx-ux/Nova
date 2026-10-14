-- ============================================================
-- ZENOA RADAR — Étape 5 : maquettes de sites vitrine.
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

-- Coordonnées GPS du prospect (posées à l'étape 2, ajoutées ici pour
-- la section "plan" de la maquette — colonnes nullable, n'affecte pas
-- les lignes déjà en base).
alter table public.radar_prospects add column if not exists lat double precision;
alter table public.radar_prospects add column if not exists lon double precision;

create table if not exists public.demo_sites (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  prospect_id   uuid references public.radar_prospects(id) on delete set null,
  slug          text not null unique,
  business_name text not null,
  city          text,
  phone         text,
  address       text,
  lat           double precision,
  lon           double precision,
  primary_color text not null default '#bf5af2',
  tagline       text,
  description   text,
  services      jsonb not null default '[]'::jsonb,       -- liste de chaînes
  testimonials  jsonb not null default '[]'::jsonb,       -- liste de {name, text}
  contact_text  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists demo_sites_user_id_idx on public.demo_sites (user_id);

alter table public.demo_sites enable row level security;

-- Lecture publique (page /demo/:slug accessible sans compte, pour que
-- le prospect puisse la consulter), écriture réservée au propriétaire.
drop policy if exists "anyone can read demo sites" on public.demo_sites;
create policy "anyone can read demo sites" on public.demo_sites
  for select to anon, authenticated using (true);

drop policy if exists "owner can manage own demo sites" on public.demo_sites;
create policy "owner can manage own demo sites" on public.demo_sites
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select on public.demo_sites to anon;
grant select, insert, update, delete on public.demo_sites to authenticated;

notify pgrst, 'reload schema';
