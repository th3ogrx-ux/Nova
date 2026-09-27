-- ============================================================
-- NOVA / ZENOA — Badges & récompenses (setters)
-- À coller dans Supabase Dashboard > SQL Editor > Run
-- Ré-exécutable sans risque.
-- ============================================================

-- Badge que le setter a choisi d'afficher à côté de son pseudo,
-- quand il en a débloqué plusieurs. Les badges eux-mêmes sont
-- calculés à la volée côté client depuis la table prospects
-- (aucune table supplémentaire n'est nécessaire).
alter table public.profiles add column if not exists selected_badge_id text;
