-- ============================================================
-- NOVA / ZENOA — Mon projet : remplace le titre du projet par les
-- liens réseaux sociaux de l'élève (Instagram, TikTok, YouTube).
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

alter table public.user_project
  add column if not exists instagram_url text,
  add column if not exists tiktok_url text,
  add column if not exists youtube_url text;

-- La policy "user can manage own project" (mon-projet.sql) couvre déjà
-- toutes les colonnes de la table (select/insert/update/delete sur sa
-- propre ligne) : rien à changer côté RLS.

notify pgrst, 'reload schema';
