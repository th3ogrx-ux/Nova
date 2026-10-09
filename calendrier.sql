-- ============================================================
-- NOVA / ZENOA — Page Calendrier : lives et rendez-vous.
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque (sauf le bloc de données de test, à ne
-- coller qu'une seule fois — voir la note plus bas).
--
-- IMPORTANT : la table public.calendar_events existait déjà (créée
-- par une fonctionnalité calendrier précédente) avec les colonnes
-- id, created_by, title, description, event_date, event_time,
-- created_at. On la réutilise telle quelle (pas de table en double) :
-- ce fichier se contente d'y AJOUTER les 2 colonnes qui manquaient
-- (join_url, replay_url) et d'activer la sécurité dessus.
-- event_date/event_time sont déjà en heure de Paris (pas de fuseau
-- stocké), donc l'app ne fait aucune conversion pour l'affichage —
-- seule la génération du fichier .ics convertit vers l'UTC, ce que
-- les fichiers .ics attendent.
-- ============================================================

alter table public.calendar_events
  add column if not exists join_url text,     -- lien de connexion (visio), affiché tant que l'event est à venir
  add column if not exists replay_url text;    -- lien du replay, affiché une fois l'event passé

alter table public.calendar_events enable row level security;

drop policy if exists "authenticated can read events" on public.calendar_events;
create policy "authenticated can read events" on public.calendar_events
  for select to authenticated using (true);

-- ============================================================
-- DONNÉES DE TEST — un événement à venir et un événement passé (pour
-- voir le rendu des deux sections). Ne coller qu'UNE SEULE FOIS.
-- ============================================================

-- created_by est obligatoire (NOT NULL) sur la table existante : on le
-- remplit avec ton propre compte (le chef), via une sous-requête plutôt
-- que de devoir coller ton user_id à la main.
insert into public.calendar_events (title, description, event_date, event_time, join_url, created_by) values
  ('Live mensuel Q&A', 'Session de questions/réponses en direct sur ton avancement.',
   (current_date + 5), '20:00:00', 'https://meet.example.com/live-zenoa',
   (select id from public.profiles where role = 'chef' limit 1));

insert into public.calendar_events (title, description, event_date, event_time, replay_url, created_by) values
  ('Live de lancement', 'Présentation du programme et de la méthode.',
   (current_date - 10), '20:00:00', null,
   (select id from public.profiles where role = 'chef' limit 1));

-- ============================================================
-- Comment ajouter un événement plus tard (Supabase Dashboard > Table
-- Editor, ou SQL Editor) :
--
--   insert into public.calendar_events (title, description, event_date, event_time, join_url, created_by)
--   values (
--     'Mon prochain live', 'Sa description courte.',
--     '2026-11-15',   -- date
--     '19:00:00',     -- heure de Paris (murale, pas de fuseau à gérer)
--     'https://lien-de-connexion.example.com',
--     (select id from public.profiles where role = 'chef' limit 1)  -- created_by est obligatoire
--   );
--
-- Une fois l'event passé, ajoute son replay avec un update :
--   update public.calendar_events set replay_url = 'https://...'
--   where title = 'Mon prochain live';
-- ============================================================
