-- ============================================================
-- NOVA / ZENOA — Page Mon projet : étapes, dépôts de travail,
-- questions pour le coach.
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque (sauf le bloc de données de test, à ne
-- coller qu'une seule fois — voir la note plus bas).
-- ============================================================

-- ----- Étapes du projet (le même modèle d'étapes pour tout le monde,
-- la progression elle est propre à chaque élève) -----
create table if not exists public.project_steps (
  id uuid primary key default gen_random_uuid(),
  position int not null,
  label text not null
);

-- ----- Le projet de chaque élève (juste un titre modifiable) -----
create table if not exists public.user_project (
  user_id uuid primary key references auth.users(id) on delete cascade,
  title text not null default 'Mon produit digital',
  updated_at timestamptz not null default now()
);

-- ----- Avancement de chaque élève sur chaque étape -----
create table if not exists public.user_project_steps (
  user_id uuid not null references auth.users(id) on delete cascade,
  step_id uuid not null references public.project_steps(id) on delete cascade,
  done boolean not null default false,
  primary key (user_id, step_id)
);

-- ----- Dépôts de travail (note, lien et/ou fichier) -----
create table if not exists public.project_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  note text,
  link_url text,
  file_path text,   -- chemin dans le bucket "project-uploads" (storage), pas une URL publique
  file_name text,
  created_at timestamptz not null default now()
);

-- ----- Questions pour le coach (lues depuis Supabase, pas de
-- messagerie dans l'app pour l'instant — voir chat-widget.js) -----
create table if not exists public.coach_questions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  answered boolean not null default false,
  created_at timestamptz not null default now()
);

-- ----- Sécurité (RLS) -----
alter table public.project_steps enable row level security;
alter table public.user_project enable row level security;
alter table public.user_project_steps enable row level security;
alter table public.project_submissions enable row level security;
alter table public.coach_questions enable row level security;

drop policy if exists "authenticated can read steps" on public.project_steps;
create policy "authenticated can read steps" on public.project_steps
  for select to authenticated using (true);

drop policy if exists "user can manage own project" on public.user_project;
create policy "user can manage own project" on public.user_project
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "user can manage own project steps" on public.user_project_steps;
create policy "user can manage own project steps" on public.user_project_steps
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "user can read own submissions" on public.project_submissions;
create policy "user can read own submissions" on public.project_submissions
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "user can insert own submissions" on public.project_submissions;
create policy "user can insert own submissions" on public.project_submissions
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "user can insert own coach questions" on public.coach_questions;
create policy "user can insert own coach questions" on public.coach_questions
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "user can read own coach questions" on public.coach_questions;
create policy "user can read own coach questions" on public.coach_questions
  for select to authenticated using (user_id = auth.uid());
-- Remarque : toi (le coach/admin) tu lis les questions directement
-- depuis Supabase > Table Editor > coach_questions (tu y as accès en
-- tant que propriétaire du projet, ces policies ne s'appliquent qu'à
-- l'app cliente avec la clé publique).

-- ----- Stockage des fichiers déposés (images/PDF, 10 Mo max) -----
-- Bucket privé : chaque élève ne peut lire/écrire que dans son propre
-- dossier (préfixé par son user_id), donc ne voit jamais les fichiers
-- des autres.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-uploads', 'project-uploads', false, 10485760,
        array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

drop policy if exists "users can upload to their own project folder" on storage.objects;
create policy "users can upload to their own project folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'project-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users can read their own project files" on storage.objects;
create policy "users can read their own project files" on storage.objects
  for select to authenticated
  using (bucket_id = 'project-uploads' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- DONNÉES DE TEST — les 4 étapes partagées. Ne coller qu'UNE SEULE
-- FOIS (pas de contrainte d'unicité sur "label", un second passage
-- créerait des doublons).
-- ============================================================

insert into public.project_steps (position, label) values
  (1, 'Choisir mon idée'),
  (2, 'Créer mon contenu'),
  (3, 'Créer mon produit'),
  (4, 'Lancer');
