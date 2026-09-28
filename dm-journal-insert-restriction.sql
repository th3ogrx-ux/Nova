-- ZENOA — n'autorise l'ajout de prospects (Journal de DMs) qu'au chef
-- et aux personnes de dm_journal_watchlist. Garde exactement les
-- mêmes conditions existantes (setter_id = auth.uid() et
-- is_active_user()), on ajoute juste la vérification en plus.

drop policy if exists "prospects_insert_own" on public.prospects;
create policy "prospects_insert_own" on public.prospects
  for insert
  with check (
    setter_id = auth.uid()
    and is_active_user()
    and (
      is_chef()
      or exists (select 1 from public.dm_journal_watchlist where profile_id = auth.uid())
    )
  );
