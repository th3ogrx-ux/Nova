-- ============================================================
-- NOVA / ZENOA — Ajoute la policy manquante pour supprimer un code
-- d'accès. admin-panel.sql n'avait créé que les policies INSERT et
-- UPDATE sur access_codes ; le bouton "✕" (qui supprime maintenant le
-- code au lieu de juste le marquer désactivé) a besoin d'une policy
-- DELETE, sinon Supabase refuse silencieusement la suppression (RLS).
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

drop policy if exists "admin can delete codes" on public.access_codes;
create policy "admin can delete codes" on public.access_codes
  for delete to authenticated using (public.is_admin());
