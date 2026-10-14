-- ============================================================
-- ZENOA RADAR — Étape 2 : recherche OpenStreetMap + table des
-- prospects (le schéma complet est posé ici, même si l'interface du
-- mini CRM n'arrive qu'à l'étape 3, pour ne pas avoir à migrer la
-- table ensuite).
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

-- ---------- Prospects (mes résultats de recherche ajoutés) ----------
create table if not exists public.radar_prospects (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  osm_id             text,                 -- "node/12345" ou "way/6789" — sert à éviter les doublons
  name               text not null,
  address            text,
  phone              text,
  website            text,
  email              text,
  category           text,
  city               text,
  site_quality       text check (site_quality in ('no_site', 'needs_update', 'good')),
  status             text not null default 'a_contacter'
                       check (status in ('a_contacter', 'contacte', 'veut_maquette', 'maquette_envoyee', 'client', 'pas_interesse')),
  notes              text,
  next_followup_date date,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Empêche d'ajouter deux fois la même fiche OSM pour un même utilisateur.
create unique index if not exists radar_prospects_user_osm_unique
  on public.radar_prospects (user_id, osm_id)
  where osm_id is not null;

create index if not exists radar_prospects_user_id_idx on public.radar_prospects (user_id);

alter table public.radar_prospects enable row level security;

drop policy if exists "user can manage own prospects" on public.radar_prospects;
create policy "user can manage own prospects" on public.radar_prospects
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.radar_prospects to authenticated;

-- ---------- Historique des recherches (sert au suivi des quotas) ----------
create table if not exists public.search_history (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  category     text not null,
  city         text not null,
  result_count integer not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists search_history_user_month_idx on public.search_history (user_id, created_at);

alter table public.search_history enable row level security;

drop policy if exists "user can read own search history" on public.search_history;
create policy "user can read own search history" on public.search_history
  for select to authenticated using (auth.uid() = user_id);

grant select on public.search_history to authenticated;
-- Pas de policy insert/update pour les utilisateurs : seule l'edge
-- function osm-search y écrit, avec la clé service_role (qui
-- contourne RLS). Empêche un utilisateur de trafiquer son propre
-- historique pour contourner son quota.

-- ---------- Cache des résultats de recherche (politesse envers l'API Overpass) ----------
create table if not exists public.business_search_cache (
  id         uuid primary key default gen_random_uuid(),
  category   text not null,
  city       text not null,
  results    jsonb not null,
  created_at timestamptz not null default now()
);

create unique index if not exists business_search_cache_category_city_unique
  on public.business_search_cache (category, city);

alter table public.business_search_cache enable row level security;
-- Aucune policy : table interne, lue/écrite uniquement par l'edge
-- function (clé service_role, qui contourne RLS). RLS activée sans
-- policy = accès refusé à tout le monde côté client, par sécurité.

-- ---------- Cache des coordonnées de ville (Nominatim) ----------
create table if not exists public.city_geocode_cache (
  id           uuid primary key default gen_random_uuid(),
  city         text not null unique,
  lat          double precision not null,
  lon          double precision not null,
  display_name text,
  created_at   timestamptz not null default now()
);

alter table public.city_geocode_cache enable row level security;
-- Aucune policy, même raison que business_search_cache.

notify pgrst, 'reload schema';
