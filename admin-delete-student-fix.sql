-- ============================================================
-- NOVA / ZENOA — Corrige admin_delete_student() (bouton "Supprimer le
-- compte" sur la fiche élève, admin-panel.sql) : un compte élève peut
-- avoir aussi servi à trier des prospects dans Zenoa Radar
-- (radar_leads.status_set_by) ou à enregistrer un lien admin
-- (admin_links.created_by), deux colonnes qui référencent profiles.id
-- SANS suppression en cascade. Sans ce correctif, supprimer un tel
-- compte échoue avec une erreur de contrainte de clé étrangère (vu en
-- pratique sur un compte de test).
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

create or replace function public.admin_delete_student(student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès refusé : réservé à l''administrateur.';
  end if;
  update public.radar_leads set status_set_by = null where status_set_by = student_id;
  update public.admin_links set created_by = null where created_by = student_id;
  delete from public.profiles where id = student_id;
  delete from auth.users where id = student_id;
end;
$$;
grant execute on function public.admin_delete_student(uuid) to authenticated;
