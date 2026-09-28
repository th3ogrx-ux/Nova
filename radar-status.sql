-- ZENOA — statut de prospection partagé sur Zenoa Radar
-- Remplace la case "Contacté" par 3 statuts mutuellement exclusifs.

alter table public.radar_leads add column if not exists status text;

alter table public.radar_leads drop constraint if exists radar_leads_status_check;
alter table public.radar_leads add constraint radar_leads_status_check
  check (status is null or status in ('interested', 'not_interested', 'pending'));

-- La policy de mise à jour existante (team can update radar leads,
-- using(true)/with check(true)) couvre déjà cette nouvelle colonne,
-- rien d'autre à faire côté droits d'accès.
