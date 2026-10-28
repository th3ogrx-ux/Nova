-- ============================================================================
-- Zenoa Agency — OPTIONNEL : supprime les anciens clients qui ne sont pas des mannequins
-- (commerces locaux, marques…). IRRÉVERSIBLE : lis d'abord la liste de l'étape 1.
-- ============================================================================

-- ÉTAPE 1 — Voir ce qui serait supprimé (à lancer seule d'abord) :
select id, nom, type, ville, created_at from public.espace_businesses where type is distinct from 'mannequin' order by nom;

-- ÉTAPE 2 — Supprimer (décommente puis lance). Supprime la fiche et, en cascade, ses chiffres, avis, tâches, messages,
-- calendrier, collaborations, liens et profils d'accès. Les comptes de connexion eux-mêmes restent dans Authentication > Users
-- (sans accès à l'appli) : supprime-les à la main si tu veux.
-- delete from public.espace_businesses where type is distinct from 'mannequin';
