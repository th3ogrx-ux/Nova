-- ============================================================
-- NOVA — Journal de DMs : mêmes statuts que Journal LinkedIn
-- (Demande mini analyse à la place d'Intéressé, Call pris à la
-- place de RDV pris).
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

alter table public.prospects drop constraint if exists prospects_status_check;
alter table public.prospects add constraint prospects_status_check
  check (status in ('sent', 'replied', 'mini_analysis_requested', 'meeting', 'sold', 'not_interested'));

update public.prospects set status = 'meeting' where status = 'interested';
