-- ============================================================
-- ZENOA — Espace clients : chiffres à suivre PAR CLIENT
-- (ex. un électricien n'a pas besoin du chiffre "Itinéraires").
-- À coller dans Supabase > SQL Editor > Run. Ré-exécutable sans risque.
-- Les clients existants gardent tous les chiffres affichés.
-- ============================================================
alter table public.espace_businesses
  add column if not exists metriques text[] not null
  default array['appels', 'itineraires', 'vues_fiche', 'visites_site'];

alter table public.espace_businesses drop constraint if exists espace_businesses_metriques_check;
alter table public.espace_businesses add constraint espace_businesses_metriques_check
  check (cardinality(metriques) >= 1 and metriques <@ array['appels', 'itineraires', 'vues_fiche', 'visites_site']);

notify pgrst, 'reload schema';
