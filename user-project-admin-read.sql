-- ============================================================
-- NOVA / ZENOA — Permet au chef de lire les réseaux sociaux de
-- chaque élève (table user_project) depuis la fiche élève.
--
-- Bug corrigé : la policy existante ("user can manage own project",
-- voir mon-projet.sql) ne laissait chaque élève lire/écrire QUE sa
-- propre ligne. Le chef n'avait donc jamais accès aux lignes des
-- élèves, et la section "Réseaux" de la fiche élève restait vide
-- même quand l'élève avait bien renseigné ses liens.
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

drop policy if exists "admin can read all projects" on public.user_project;
create policy "admin can read all projects" on public.user_project
  for select to authenticated
  using (public.is_admin());

notify pgrst, 'reload schema';
