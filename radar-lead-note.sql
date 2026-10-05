-- ============================================================
-- NOVA / ZENOA — Note libre par lead (carte "Leads intéressés" du Workspace)
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

alter table public.radar_leads add column if not exists note text;

-- La policy de mise à jour existante ("team can update radar leads",
-- using(true)/with check(true)) couvre déjà cette nouvelle colonne,
-- rien d'autre à faire côté droits d'accès.
