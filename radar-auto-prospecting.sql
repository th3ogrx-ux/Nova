-- ============================================================
-- ZENOA RADAR — Prospection automatique quotidienne
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

-- La prospection automatique ne demande plus de choisir une
-- catégorie/ville (elle cherche désormais partout en France) : la
-- table de réglages par utilisateur n'est plus nécessaire.
drop table if exists public.radar_search_settings;

-- ---------- Prospects générés automatiquement chaque jour ----------
create table if not exists public.radar_leads (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  osm_id       text,                 -- sert à ne jamais reproposer la même fiche
  name         text not null,
  address      text,
  phone        text,
  website      text,
  email        text,
  category     text,
  city         text,
  site_quality text check (site_quality in ('no_site', 'needs_update', 'good')),
  status       text not null default 'en_attente'
                 check (status in ('en_attente', 'interesse', 'pas_interesse')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index if not exists radar_leads_user_osm_unique
  on public.radar_leads (user_id, osm_id)
  where osm_id is not null;

create index if not exists radar_leads_user_status_idx on public.radar_leads (user_id, status);

alter table public.radar_leads enable row level security;

-- L'utilisateur peut voir et faire évoluer le statut de ses propres
-- prospects, mais seule la fonction radar-daily (clé service_role,
-- qui contourne RLS) peut en insérer de nouveaux — empêche un
-- utilisateur de générer lui-même des leads en dehors du quota
-- quotidien.
drop policy if exists "user can read own radar leads" on public.radar_leads;
create policy "user can read own radar leads" on public.radar_leads
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "user can update own radar leads" on public.radar_leads;
create policy "user can update own radar leads" on public.radar_leads
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, update on public.radar_leads to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- Plus de job planifié : les serveurs Overpass gratuits refusent les
-- appels venant de Supabase. Les prospects du jour sont désormais
-- générés à la première ouverture de Zenoa Radar dans la journée
-- (recherche faite par le navigateur, enregistrement par la fonction
-- radar-daily). Ce bloc supprime les anciens jobs s'ils existent.
-- ============================================================

select cron.unschedule(jobname)
from cron.job
where jobname in ('radar-daily-job', 'zenoa-radar-daily');
