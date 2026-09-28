-- ZENOA — restreint l'accès à Zenoa Radar (et son Journal) aux seules
-- personnes ajoutées par le chef dans radar_journal_watchlist (+ le
-- chef, toujours autorisé). Remplace l'ancienne policy "tout le monde
-- peut lire" par une vérification d'appartenance à la watchlist.

drop policy if exists "team can read radar leads" on public.radar_leads;
create policy "team can read radar leads" on public.radar_leads
  for select to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'chef')
    or exists (select 1 from public.radar_journal_watchlist where profile_id = auth.uid())
  );

drop policy if exists "team can update radar leads" on public.radar_leads;
create policy "team can update radar leads" on public.radar_leads
  for update to authenticated
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'chef')
    or exists (select 1 from public.radar_journal_watchlist where profile_id = auth.uid())
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'chef')
    or exists (select 1 from public.radar_journal_watchlist where profile_id = auth.uid())
  );
