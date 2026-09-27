-- ============================================================
-- NOVA — Rôles personnalisés (attribués par le chef à chaque membre)
-- À coller dans Supabase Dashboard > SQL Editor > Run
-- Ré-exécutable sans risque.
-- ============================================================

alter table public.profiles add column if not exists custom_role text;

-- Seul le chef peut modifier le rôle personnalisé d'un membre (y compris le sien).
-- Les policies RLS étant permissives (OR), ceci s'ajoute sans retirer les
-- policies existantes qui permettent déjà à chacun de modifier sa propre ligne.
drop policy if exists "profiles_update_role_by_chef" on public.profiles;
create policy "profiles_update_role_by_chef" on public.profiles
  for update using (public.is_chef()) with check (public.is_chef());

grant update on public.profiles to authenticated;
