-- ============================================================
-- NOVA / ZENOA — Permissions affinées pour les "Membres"
-- (suite à roles-chef-membre.sql, qui avait donné role='chef' à tout
-- le monde pour un accès complet temporaire)
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

-- 1) Remet les membres (repérés via le label "Membre" posé par la
-- migration précédente) sur un rôle distinct du chef, pour que
-- is_chef() et les écrans "chef-only" redeviennent corrects :
--   - Gestion (+ sous-dossiers) et Partenariat (+ sous-dossiers) :
--     redeviennent invisibles pour eux (déjà géré par le code existant,
--     rien d'autre à faire une fois le rôle changé)
--   - Résultats (CA total, ventes one-shot...) : policy one_shot_sales
--     déjà en lecture libre / écriture chef seulement → déjà correct
--   - Leads / Zenoa Radar : accès inchangé, dépend de
--     radar_journal_watchlist (pas du rôle), donc pas affecté par ce
--     changement de rôle
update public.profiles
set role = 'membre'
where custom_role = 'Membre';

-- 2) Donne à toute l'équipe connectée un accès en LECTURE SEULE à la
-- table clients (liste + CA affichés dans Rubriques > Résultat), sans
-- toucher aux policies d'écriture existantes (réservées au chef).
-- Policy additive : les policies RLS d'un même type se combinent en OR,
-- donc ceci élargit juste qui peut LIRE sans rien retirer ailleurs.
drop policy if exists "all team can read clients" on public.clients;
create policy "all team can read clients" on public.clients
  for select to authenticated
  using (true);
