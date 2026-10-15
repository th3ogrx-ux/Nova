-- ============================================================
-- ZENOA RADAR — Suppression de compte.
-- Supprime aussi la photo de profil dans le stockage, puis le compte
-- (toutes les autres données de l'utilisateur partent en cascade :
-- plans, prospects, modèles, maquettes, profil — toutes leurs clés
-- étrangères pointent vers auth.users avec "on delete cascade").
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  delete from storage.objects where bucket_id = 'avatars' and (storage.foldername(name))[1] = uid::text;
  delete from auth.users where id = uid;
end;
$$;

grant execute on function public.delete_my_account() to authenticated;

notify pgrst, 'reload schema';
