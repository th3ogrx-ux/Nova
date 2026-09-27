-- ============================================================
-- NOVA — Journal de DMs : autoriser les nouveaux statuts de prospect
-- (Vendu, Intéressé) dans la colonne prospects.status
-- À coller dans Supabase Dashboard > SQL Editor > Run
-- Ré-exécutable sans risque.
-- ============================================================

-- Supprime toute contrainte CHECK existante sur la colonne status,
-- quel que soit son nom (on ne connaît pas le nom exact généré à
-- l'origine, donc on la retrouve dynamiquement).
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.prospects'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.prospects drop constraint %I', con.conname);
  end loop;
end $$;

-- Recrée une contrainte qui inclut les nouveaux statuts.
alter table public.prospects add constraint prospects_status_check
  check (status in ('sent', 'replied', 'meeting', 'not_interested', 'interested', 'sold'));
