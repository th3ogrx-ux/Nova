-- ============================================================
-- ZENOA — Journal LinkedIn : nouveaux statuts (Demande audit,
-- Call pris à la place de RDV pris, suppression d'Intéressé).
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

alter table public.linkedin_prospects drop constraint if exists linkedin_prospects_status_check;
alter table public.linkedin_prospects add constraint linkedin_prospects_status_check
  check (status in ('sent', 'replied', 'audit_requested', 'meeting', 'sold', 'not_interested'));

update public.linkedin_prospects set status = 'meeting' where status = 'interested';
