-- ============================================================================
-- Zenoa Agency — ajoute l'offre « Lancement pour marques » (page Offres).
-- SQL Editor > New query > coller > Run. N'efface PAS les autres offres (relançable : remplace seulement celle-ci).
-- ============================================================================
do $$
declare v_admin uuid;
begin
  select id into v_admin from public.espace_profiles where role = 'admin' order by created_at limit 1;
  if v_admin is null then raise exception 'Aucun compte administrateur trouvé (espace_profiles).'; end if;

  delete from public.pro_offers where user_id = v_admin and nom = 'Lancement pour marques';

  insert into public.pro_offers (user_id, nom, prix, periode, description, atouts, populaire, position) values
  (v_admin, 'Lancement pour marques', 250, 'mois',
   'On gère ton Instagram et ton TikTok de A à Z, tu valides chaque vidéo avant publication.',
   E'essai: 150 | Premier mois, site compris\n## À la mise en place\nPlan de contenu sur 30 jours\nSite vitrine personnalisé, inclus\n## Chaque mois\nGestion de ton Instagram et de ton TikTok : 12 publications (visuels et vidéos)\nValidation de chaque vidéo par toi avant publication\n6 créateurs et mannequins contactés pour des collaborations\nUn point chaque semaine\nUn rapport mensuel',
   false, 1);
end $$;
