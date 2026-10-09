-- ============================================================
-- NOVA / ZENOA — Page Calendrier : lives et rendez-vous.
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque (sauf le bloc de données de test, à ne
-- coller qu'une seule fois — voir la note plus bas).
-- ============================================================

create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  -- Stockées en UTC (timestamptz) comme il se doit ; l'app les
  -- affiche converties en Europe/Paris automatiquement, quelle que
  -- soit l'heure locale de la personne qui regarde.
  starts_at timestamptz not null,
  ends_at timestamptz,
  join_url text,     -- lien de connexion (visio), affiché tant que l'event est à venir
  replay_url text,   -- lien du replay, affiché une fois l'event passé
  created_at timestamptz not null default now()
);

alter table public.calendar_events enable row level security;

drop policy if exists "authenticated can read events" on public.calendar_events;
create policy "authenticated can read events" on public.calendar_events
  for select to authenticated using (true);

-- ============================================================
-- DONNÉES DE TEST — un événement à venir et un événement passé (pour
-- voir le rendu des deux sections). Ne coller qu'UNE SEULE FOIS.
-- Les heures ci-dessous sont écrites en UTC ('Z') ; 18:00 UTC = 20:00
-- heure de Paris en été (19:00 en hiver) — ajuste si besoin.
-- ============================================================

insert into public.calendar_events (title, description, starts_at, join_url) values
  ('Live mensuel Q&A', 'Session de questions/réponses en direct sur ton avancement.',
   (now() + interval '5 days') at time zone 'utc', 'https://meet.example.com/live-zenoa');

insert into public.calendar_events (title, description, starts_at, replay_url) values
  ('Live de lancement', 'Présentation du programme et de la méthode.',
   (now() - interval '10 days') at time zone 'utc', null);

-- ============================================================
-- Comment ajouter un événement plus tard (Supabase Dashboard > Table
-- Editor, ou SQL Editor) :
--
--   insert into public.calendar_events (title, description, starts_at, join_url)
--   values (
--     'Mon prochain live', 'Sa description courte.',
--     '2026-11-15 19:00:00+01',  -- heure Paris : ajoute le décalage (+01 hiver, +02 été)
--     'https://lien-de-connexion.example.com'
--   );
--
-- Une fois l'event passé, ajoute son replay avec un update :
--   update public.calendar_events set replay_url = 'https://...'
--   where title = 'Mon prochain live';
-- ============================================================
