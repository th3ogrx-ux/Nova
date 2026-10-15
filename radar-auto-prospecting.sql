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
-- Planification quotidienne (pg_cron + pg_net, extensions gratuites
-- déjà disponibles sur le plan gratuit Supabase).
--
-- ÉTAPES MANUELLES avant d'exécuter le bloc ci-dessous :
--   1) Remplace <PROJECT_REF> par l'identifiant du projet (Settings >
--      General > Project ID).
--   2) Remplace <RADAR_CRON_SECRET> par la valeur du secret du même
--      nom (Edge Functions > Secrets) — c'est ce que vérifie la
--      fonction radar-daily dans le header "x-cron-secret".
--   3) Colle et exécute tout le bloc.
-- Le job tourne chaque jour à 6h du matin (heure serveur, UTC — pas
-- forcément 6h heure française selon la saison).
-- Ce bloc est ré-exécutable sans risque : il remplace le job existant
-- plutôt que d'en recréer un.
-- ============================================================

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

-- Ancien job de l'appli d'avant la remise à zéro, s'il tourne encore.
select cron.unschedule('zenoa-radar-daily') where exists (
  select 1 from cron.job where jobname = 'zenoa-radar-daily'
);

select cron.unschedule('radar-daily-job') where exists (
  select 1 from cron.job where jobname = 'radar-daily-job'
);

select cron.schedule(
  'radar-daily-job',
  '0 6 * * *',
  $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.supabase.co/functions/v1/radar-daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<RADAR_CRON_SECRET>'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 150000
  );
  $$
);
