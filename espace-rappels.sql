-- ============================================================
-- ZENOA — Espace clients : date de la PROCHAINE MISE À JOUR des chiffres,
-- par client (rappel dans la liste "Clients", en couleur vive à 3 jours).
-- À coller dans Supabase > SQL Editor > Run. Ré-exécutable sans risque.
-- ============================================================
alter table public.espace_businesses add column if not exists prochaine_maj date;
notify pgrst, 'reload schema';
