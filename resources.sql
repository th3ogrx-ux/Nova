-- ============================================================
-- ZENOA RADAR — Ressources (liens et PDF avec page de couverture)
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

create table if not exists public.resources (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('link', 'pdf')),
  title      text not null check (char_length(title) between 1 and 200),
  url        text check (char_length(url) <= 2000),        -- lien (kind = 'link')
  file_path  text check (char_length(file_path) <= 500),   -- PDF dans le bucket "resources"
  cover_url  text check (char_length(cover_url) <= 2000),  -- image d'aperçu d'un lien (hébergée ailleurs)
  cover_path text check (char_length(cover_path) <= 500),  -- 1re page d'un PDF, dans le bucket "resources"
  created_at timestamptz not null default now()
);

create index if not exists resources_user_created_idx on public.resources (user_id, created_at desc);

alter table public.resources enable row level security;

drop policy if exists "user can manage own resources" on public.resources;
create policy "user can manage own resources" on public.resources
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, delete on public.resources to authenticated;

-- ---------- Fichiers (PDF + couvertures) : bucket privé, 1 dossier par utilisateur ----------
-- Privé : un PDF n'est lisible que par son propriétaire, via des liens
-- signés temporaires générés par l'appli. 25 Mo maximum par fichier.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resources', 'resources', false, 26214400, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "user can read own resource files" on storage.objects;
create policy "user can read own resource files" on storage.objects
  for select to authenticated
  using (bucket_id = 'resources' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "user can upload own resource files" on storage.objects;
create policy "user can upload own resource files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'resources' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "user can delete own resource files" on storage.objects;
create policy "user can delete own resource files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'resources' and (storage.foldername(name))[1] = auth.uid()::text);

notify pgrst, 'reload schema';
