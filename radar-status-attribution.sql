-- ZENOA — sait qui a mis quel statut sur un prospect Zenoa Radar,
-- pour afficher "Activité de l'équipe" par personne dans le Journal
-- de Zenoa Radar (comme dans le Journal de DMs).

alter table public.radar_leads add column if not exists status_set_by uuid references public.profiles(id);
