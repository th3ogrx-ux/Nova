-- ============================================================================
-- Zenoa Agency — met à jour l'offre « Offre mannequins » (page Offres).
-- SQL Editor > New query > coller > Run. Remplace seulement l'ancienne offre mannequin ; les autres offres ne bougent pas.
-- ============================================================================
do $$
declare v_admin uuid;
begin
  select id into v_admin from public.espace_profiles where role = 'admin' order by created_at limit 1;
  if v_admin is null then raise exception 'Aucun compte administrateur trouvé (espace_profiles).'; end if;

  delete from public.pro_offers where user_id = v_admin and nom in ('Gestion complète de mannequin', 'Offre mannequins');

  insert into public.pro_offers (user_id, nom, prix, periode, description, atouts, populaire, position) values
  (v_admin, 'Offre mannequins', 200, 'mois',
   'On gère toute la partie business pour que tu te concentres sur ton métier. Tu valides chaque publication avant sa sortie.',
   E'essai: 80 | Premier mois, portfolio compris\n## À la mise en place\nPortfolio en ligne premium à ton nom\nProfil et bio refaits\nMedia kit d''une page\n## Chaque mois\nGestion de ton Instagram\nPréparation de tes contenus TikTok (idées, légendes, horaires), que tu publies toi-même\n20 marques ciblées contactées\n3 photographes contactés pour des shootings\nValidation de chaque publication par toi avant sa sortie\nUn point chaque semaine\nUn rapport mensuel\n+ Option UGC | +100 € / mois | Contact de marques pour des collaborations UGC, brief et script de chaque vidéo, gestion des échanges avec les marques',
   true, 0);
end $$;
