-- ============================================================
-- NOVA — Ressources : bloc principal épinglé (rectangle en haut)
-- À coller dans Supabase Dashboard > SQL Editor > Run
-- ============================================================

alter table public.resource_categories add column if not exists is_pinned boolean not null default false;
