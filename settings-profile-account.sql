-- ============================================================
-- NOVA / ZENOA — Paramètres : Profil / Notifications / Suppression
-- de compte (RGPD).
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

-- Préférences de notifications (true par défaut).
alter table public.profiles
  add column if not exists notif_email boolean not null default true,
  add column if not exists notif_reminders boolean not null default true;

-- Chacun peut mettre à jour sa propre ligne (pseudo, email, préférences
-- de notifications). Politique additive : ne touche à aucune politique
-- existante.
drop policy if exists "user can update own profile" on public.profiles;
create policy "user can update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Suppression de compte (droit à l'effacement RGPD) : fonction appelée
-- par l'utilisateur connecté pour supprimer sa propre ligne de profil
-- ET son compte d'authentification. SECURITY DEFINER est nécessaire
-- car un utilisateur normal n'a pas le droit de supprimer dans
-- auth.users lui-même.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.profiles where id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

grant execute on function public.delete_my_account() to authenticated;
