-- ZENOA — Radar : qualification des prospects avec leur fiche Google.
-- À coller dans Supabase > SQL Editor > Run (relançable sans risque). Ne touche pas à tes données.
-- Google ne donne pas gratuitement le nombre d'avis, la note, les photos… : tu les notes à la main
-- depuis la fiche (bouton « Fiche Google » sur chaque prospect) et le Radar te dit si le prospect
-- remplit tes critères.
alter table public.radar_leads add column if not exists g_avis integer check (g_avis between 0 and 100000);
alter table public.radar_leads add column if not exists g_note numeric(2,1) check (g_note between 1 and 5);
alter table public.radar_leads add column if not exists g_photos integer check (g_photos between 0 and 100000);
alter table public.radar_leads add column if not exists g_description boolean;
alter table public.radar_leads add column if not exists g_sans_reponse boolean;
alter table public.radar_leads add column if not exists g_dernier_avis date;
notify pgrst, 'reload schema';
