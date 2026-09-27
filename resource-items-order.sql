-- ============================================================
-- ZENOA — Ressources : ordre personnalisé des phrases/items
-- (édition au crayon + réordonnancement en appui long)
-- À coller dans Supabase Dashboard > SQL Editor > Run
-- ============================================================

alter table public.resource_items add column if not exists sort_order integer not null default 0;

-- Initialise l'ordre existant selon la date de création (une seule fois)
with ordered as (
  select id, row_number() over (partition by category_id order by created_at) - 1 as rn
  from public.resource_items
)
update public.resource_items i
set sort_order = o.rn
from ordered o
where o.id = i.id and i.sort_order = 0;
