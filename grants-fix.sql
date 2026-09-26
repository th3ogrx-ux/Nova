-- ============================================================
-- NOVA — Correctif : droits d'accès manquants sur les nouvelles tables
-- À coller dans Supabase Dashboard > SQL Editor > Run
-- (les policies RLS existaient déjà, mais sans GRANT elles ne servent à rien)
-- ============================================================

grant select, insert, update on public.messages to authenticated;
grant select, insert on public.message_reads to authenticated;
grant select, insert, update, delete on public.resource_categories to authenticated;
grant select, insert, update, delete on public.resource_items to authenticated;
