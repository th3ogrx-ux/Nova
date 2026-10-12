-- ============================================================
-- NOVA / ZENOA — Suppression complète de Zenoa Radar.
-- L'interface a déjà été retirée du site ; ce script arrête le tirage
-- quotidien côté serveur (pg_cron) qui continuait d'envoyer une
-- notification tous les jours, puis supprime les tables associées.
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

-- Arrête le tirage quotidien (c'est lui qui déclenchait la notif).
do $$
begin
  perform cron.unschedule('zenoa-radar-daily');
exception when others then
  null; -- déjà désactivé ou jamais programmé
end $$;

drop table if exists public.radar_leads cascade;
drop table if exists public.radar_journal_watchlist cascade;

notify pgrst, 'reload schema';
