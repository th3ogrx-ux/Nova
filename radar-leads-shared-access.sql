-- ============================================================
-- NOVA / ZENOA — Les leads Zenoa Radar sont partagés par TOUTE
-- l'équipe (chef + membres), peu importe radar_journal_watchlist.
-- Ce qu'une personne marque (intéressé, non intéressé, note...) est
-- donc vu immédiatement par tout le monde, sur le même compte partagé
-- de leads.
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

drop policy if exists "team can read radar leads" on public.radar_leads;
create policy "team can read radar leads" on public.radar_leads
  for select to authenticated
  using (true);

drop policy if exists "team can update radar leads" on public.radar_leads;
create policy "team can update radar leads" on public.radar_leads
  for update to authenticated
  using (true)
  with check (true);

drop policy if exists "team can delete radar leads" on public.radar_leads;
create policy "team can delete radar leads" on public.radar_leads
  for delete to authenticated
  using (true);
