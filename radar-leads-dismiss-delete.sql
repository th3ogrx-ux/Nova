-- ============================================================
-- NOVA / ZENOA — Nouveau système de tri des leads :
--   - un lead "non traité" peut être écarté (croix = statut "dismissed",
--     grisé puis retiré de la liste) au lieu des 2 anciens boutons
--     Intéressé / Non intéressé
--   - un lead "Intéressé" peut être définitivement supprimé
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

alter table public.radar_leads drop constraint if exists radar_leads_status_check;
alter table public.radar_leads add constraint radar_leads_status_check
  check (status is null or status in ('interested', 'not_interested', 'pending', 'dismissed'));

-- Autorise la suppression définitive d'un lead (chef, ou membre ajouté à
-- la watchlist Zenoa Radar — même condition que la policy de lecture).
drop policy if exists "team can delete radar leads" on public.radar_leads;
create policy "team can delete radar leads" on public.radar_leads
  for delete to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'chef')
    or exists (select 1 from public.radar_journal_watchlist where profile_id = auth.uid())
  );

-- ------------------------------------------------------------
-- OPTIONNEL — À LANCER UNE SEULE FOIS (pas à chaque ré-exécution) :
-- vide la liste "Leads intéressés" actuelle pour repartir à zéro avec
-- le nouveau système. Si tu as déjà des leads intéressés que tu veux
-- garder, saute cette ligne.
-- ------------------------------------------------------------
-- delete from public.radar_leads where status = 'interested';
