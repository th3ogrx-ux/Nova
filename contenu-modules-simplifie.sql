-- ============================================================
-- NOVA / ZENOA — Simplification de la page Contenu (admin) : modules
-- avec image de couverture uniquement (leçons/ressources/nouveautés/
-- événements restent gérables depuis le Table Editor de Supabase si
-- besoin, mais n'ont plus d'interface dédiée dans l'app).
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

-- ----- Image de couverture d'un module -----
alter table public.course_modules
  add column if not exists cover_url text;

-- ----- Stockage des images de couverture -----
-- Bucket PUBLIC (contrairement à project-uploads) : les couvertures de
-- module doivent s'afficher directement via une URL simple, sans lien
-- signé, aussi bien pour l'admin que pour les élèves plus tard sur la
-- page Cours. Aucune donnée sensible n'y est stockée (juste des images
-- de présentation), donc la lecture publique est sans risque.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('module-covers', 'module-covers', true, 5242880,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "anyone can view module covers" on storage.objects;
create policy "anyone can view module covers" on storage.objects
  for select using (bucket_id = 'module-covers');

drop policy if exists "admin can upload module covers" on storage.objects;
create policy "admin can upload module covers" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'module-covers' and public.is_admin());

drop policy if exists "admin can delete module covers" on storage.objects;
create policy "admin can delete module covers" on storage.objects
  for delete to authenticated
  using (bucket_id = 'module-covers' and public.is_admin());
