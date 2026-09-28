-- ZENOA — case à cocher "Contacté" partagée sur Zenoa Radar
-- (pour que toute l'équipe voie qui a déjà été prospecté)

alter table public.radar_leads add column if not exists contacted boolean not null default false;

drop policy if exists "team can update radar leads" on public.radar_leads;
create policy "team can update radar leads"
  on public.radar_leads for update
  to authenticated
  using (true)
  with check (true);
