-- ============================================================
-- NOVA / ZENOA — Page Accueil : mission du moment (case "Fait ✅"
-- sauvegardée par utilisateur).
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

alter table public.profiles
  add column if not exists mission_done boolean not null default false;

-- La politique "user can update own profile" (créée dans
-- settings-profile-account.sql) couvre déjà la mise à jour de cette
-- colonne par l'utilisateur connecté lui-même : rien d'autre à faire.
