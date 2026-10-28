-- ============================================================================
-- Zenoa Agency — remplace TOUTES tes offres par l'« Offre Zenoa : gestion complète de mannequin »
-- (SQL Editor > Run). Supprime les offres existantes de la page Suivi prospection > Scripts et offres.
-- Les stratégies qui utilisaient une ancienne offre n'ont simplement plus d'offre liée.
-- ============================================================================
do $$
declare v_admin uuid;
begin
  select id into v_admin from public.espace_profiles where role = 'admin' order by created_at limit 1;
  if v_admin is null then raise exception 'Aucun compte administrateur trouvé (espace_profiles).'; end if;

  delete from public.pro_offers where user_id = v_admin;

  insert into public.pro_offers (user_id, nom, prix, periode, description, atouts, populaire, position) values
  (v_admin, 'Gestion complète de mannequin', 300, 'mois',
   'On gère toute la partie business pour que tu te concentres sur ton métier.',
   E'essai: 120\n## Mise en place (une seule fois)\nPortfolio premium en ligne à ton nom : meilleures photos, mesures, contact\nProfil et bio refaits pour parler aux marques et aux agences\nMedia kit d''une page, prêt à envoyer\nAudit de tes photos : conseils pour un book propre (portraits, profil, plein pied, polaroids)\n## Chaque mois\nInstagram : planification et publication de tes contenus\nTikTok : idées, légendes et horaires préparés, tu publies toi-même\n60 marques ciblées contactées, messages personnalisés\nPhotographes contactés pour des shootings (TFP ou tarif réduit)\nCandidatures aux agences : choix, dossier, envoi\nUn point chaque semaine : fait, réponses reçues, suite\nAccès à l''application Zenoa pour suivre ton dossier\n+ Option contenu UGC : +100 € par mois. On contacte des marques, on prépare le brief et le script de chaque vidéo, on gère les échanges, tu tournes',
   true, 0);
end $$;
