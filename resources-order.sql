-- ============================================================
-- NOVA — Ressources : ordre personnalisé des cartes (drag & drop)
-- À coller dans Supabase Dashboard > SQL Editor > Run
-- ============================================================

alter table public.resource_categories add column if not exists sort_order integer not null default 0;

-- Initialise l'ordre existant selon la date de création (une seule fois)
with ordered as (
  select id, row_number() over (order by created_at) as rn
  from public.resource_categories
  where is_pinned = false
)
update public.resource_categories c
set sort_order = o.rn
from ordered o
where o.id = c.id and c.sort_order = 0;
