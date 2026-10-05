-- ============================================================
-- NOVA / ZENOA — Simplification à 2 rôles : "chef" (toi) et "membre"
-- (accès identique à celui du chef, label affiché "Membre")
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

-- 1) Label affiché sous le pseudo des membres (avant de toucher au rôle,
-- pour repérer qui n'était pas déjà "chef"). Le champ custom_role ne sert
-- qu'à l'affichage, pas à l'accès.
update public.profiles
set custom_role = 'Membre'
where role is distinct from 'chef';

-- 2) Donne à tous les comptes un accès complet identique au chef
-- (role = 'chef' est utilisé partout : UI "chef-only", et la fonction
-- public.is_chef() dans les policies RLS de quasi toutes les tables).
update public.profiles
set role = 'chef'
where role is distinct from 'chef';
