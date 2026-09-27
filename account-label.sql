-- ============================================================
-- NOVA / ZENOA — Étiquette Actif / Test dans Gérer l'équipe
-- À coller dans Supabase Dashboard > SQL Editor > Run
-- Ré-exécutable sans risque.
-- ============================================================

alter table public.profiles add column if not exists account_label text not null default 'actif';
