-- ============================================================
-- NOVA / ZENOA — Page Cours : modules, leçons et progression.
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque pour les tables/policies (les "create
-- table if not exists" et "drop policy if exists" ne cassent rien).
-- Le bloc de données de test à la fin, lui, ne doit être collé qu'une
-- seule fois (sinon il duplique les modules/leçons de test) — voir la
-- note en bas du fichier.
-- ============================================================

-- ----- Modules -----
create table if not exists public.course_modules (
  id uuid primary key default gen_random_uuid(),
  position int not null,
  title text not null,
  description text,
  created_at timestamptz not null default now()
);

-- ----- Leçons -----
create table if not exists public.course_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.course_modules(id) on delete cascade,
  position int not null,
  title text not null,
  duration_minutes int,
  -- 'text' : contenu écrit dans content_text. 'video' : vidéo dans
  -- video_url (content_text peut quand même servir de description).
  content_type text not null default 'text' check (content_type in ('text', 'video')),
  content_text text,
  video_url text,
  created_at timestamptz not null default now()
);

-- ----- Progression (une ligne par élève et par leçon terminée) -----
create table if not exists public.user_lesson_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id uuid not null references public.course_lessons(id) on delete cascade,
  completed boolean not null default false,
  completed_at timestamptz,
  primary key (user_id, lesson_id)
);

-- ----- Sécurité (RLS) -----
alter table public.course_modules enable row level security;
alter table public.course_lessons enable row level security;
alter table public.user_lesson_progress enable row level security;

-- Modules et leçons : lecture seule, par n'importe quel compte connecté
-- (même contenu pour tout le monde). L'ajout/modification de contenu se
-- fait depuis le SQL Editor ou le Table Editor de Supabase (voir plus
-- bas "Comment ajouter un module / une leçon"), pas depuis l'app.
drop policy if exists "authenticated can read modules" on public.course_modules;
create policy "authenticated can read modules" on public.course_modules
  for select to authenticated using (true);

drop policy if exists "authenticated can read lessons" on public.course_lessons;
create policy "authenticated can read lessons" on public.course_lessons
  for select to authenticated using (true);

-- Progression : chacun ne voit/modifie que sa propre progression.
drop policy if exists "user can read own progress" on public.user_lesson_progress;
create policy "user can read own progress" on public.user_lesson_progress
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "user can insert own progress" on public.user_lesson_progress;
create policy "user can insert own progress" on public.user_lesson_progress
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "user can update own progress" on public.user_lesson_progress;
create policy "user can update own progress" on public.user_lesson_progress
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- DONNÉES DE TEST — à remplacer par ton vrai contenu plus tard.
-- Ne coller ce bloc qu'UNE SEULE FOIS : le ré-exécuter dupliquerait
-- les modules et leçons de test (ils n'ont pas de contrainte
-- d'unicité sur le titre). Si tu dois le relancer, supprime d'abord
-- les lignes de test existantes :
--   delete from public.course_modules where title in (
--     'Les bases de Claude Code', 'Créer du contenu',
--     'Créer ton produit digital', 'Vendre et lancer'
--   );
-- (la suppression d'un module supprime aussi ses leçons, grâce à
-- "on delete cascade" ci-dessus).
-- ============================================================

insert into public.course_modules (position, title, description) values
  (1, 'Les bases de Claude Code', 'Installer, comprendre et utiliser Claude Code pour la première fois.'),
  (2, 'Créer du contenu', 'Trouver des idées, rédiger et produire du contenu avec Claude Code.'),
  (3, 'Créer ton produit digital', 'Construire ton produit digital de A à Z avec Claude Code.'),
  (4, 'Vendre et lancer', 'Structurer ton offre, ta page de vente et lancer ton produit.');

insert into public.course_lessons (module_id, position, title, duration_minutes, content_type, content_text)
  select id, 1, 'Installer et configurer Claude Code', 10, 'text',
    'Contenu de test : remplace ce texte par le vrai contenu de la leçon (texte ou vidéo) depuis Supabase > Table Editor > course_lessons.'
  from public.course_modules where title = 'Les bases de Claude Code'
union all
  select id, 2, 'Comprendre les commandes essentielles', 12, 'text',
    'Contenu de test : remplace ce texte par le vrai contenu de la leçon (texte ou vidéo) depuis Supabase > Table Editor > course_lessons.'
  from public.course_modules where title = 'Les bases de Claude Code'
union all
  select id, 3, 'Ton premier projet avec Claude Code', 15, 'text',
    'Contenu de test : remplace ce texte par le vrai contenu de la leçon (texte ou vidéo) depuis Supabase > Table Editor > course_lessons.'
  from public.course_modules where title = 'Les bases de Claude Code'

union all
  select id, 1, 'Trouver des idées de contenu', 10, 'text',
    'Contenu de test : remplace ce texte par le vrai contenu de la leçon (texte ou vidéo) depuis Supabase > Table Editor > course_lessons.'
  from public.course_modules where title = 'Créer du contenu'
union all
  select id, 2, 'Rédiger avec Claude Code', 14, 'text',
    'Contenu de test : remplace ce texte par le vrai contenu de la leçon (texte ou vidéo) depuis Supabase > Table Editor > course_lessons.'
  from public.course_modules where title = 'Créer du contenu'
union all
  select id, 3, 'Générer des visuels et miniatures', 12, 'text',
    'Contenu de test : remplace ce texte par le vrai contenu de la leçon (texte ou vidéo) depuis Supabase > Table Editor > course_lessons.'
  from public.course_modules where title = 'Créer du contenu'
union all
  select id, 4, 'Organiser et publier ton contenu', 10, 'text',
    'Contenu de test : remplace ce texte par le vrai contenu de la leçon (texte ou vidéo) depuis Supabase > Table Editor > course_lessons.'
  from public.course_modules where title = 'Créer du contenu'

union all
  select id, 1, 'Définir ton produit digital', 12, 'text',
    'Contenu de test : remplace ce texte par le vrai contenu de la leçon (texte ou vidéo) depuis Supabase > Table Editor > course_lessons.'
  from public.course_modules where title = 'Créer ton produit digital'
union all
  select id, 2, 'Structurer le contenu de ton produit', 15, 'text',
    'Contenu de test : remplace ce texte par le vrai contenu de la leçon (texte ou vidéo) depuis Supabase > Table Editor > course_lessons.'
  from public.course_modules where title = 'Créer ton produit digital'
union all
  select id, 3, 'Construire ton produit avec Claude Code', 18, 'text',
    'Contenu de test : remplace ce texte par le vrai contenu de la leçon (texte ou vidéo) depuis Supabase > Table Editor > course_lessons.'
  from public.course_modules where title = 'Créer ton produit digital'
union all
  select id, 4, 'Relire et finaliser ton produit', 10, 'text',
    'Contenu de test : remplace ce texte par le vrai contenu de la leçon (texte ou vidéo) depuis Supabase > Table Editor > course_lessons.'
  from public.course_modules where title = 'Créer ton produit digital'

union all
  select id, 1, 'Structurer une offre claire', 12, 'text',
    'Contenu de test : remplace ce texte par le vrai contenu de la leçon (texte ou vidéo) depuis Supabase > Table Editor > course_lessons.'
  from public.course_modules where title = 'Vendre et lancer'
union all
  select id, 2, 'Créer ta page de vente', 15, 'text',
    'Contenu de test : remplace ce texte par le vrai contenu de la leçon (texte ou vidéo) depuis Supabase > Table Editor > course_lessons.'
  from public.course_modules where title = 'Vendre et lancer'
union all
  select id, 3, 'Lancer ton produit', 12, 'text',
    'Contenu de test : remplace ce texte par le vrai contenu de la leçon (texte ou vidéo) depuis Supabase > Table Editor > course_lessons.'
  from public.course_modules where title = 'Vendre et lancer';

-- ============================================================
-- Comment ajouter un module / une leçon plus tard (Supabase Dashboard
-- > Table Editor, ou SQL Editor) :
--
-- Un module :
--   insert into public.course_modules (position, title, description)
--   values (5, 'Mon nouveau module', 'Sa description courte.');
--
-- Une leçon dans ce module :
--   insert into public.course_lessons
--     (module_id, position, title, duration_minutes, content_type, content_text)
--   values (
--     (select id from public.course_modules where title = 'Mon nouveau module'),
--     1, 'Ma première leçon', 10, 'text', 'Le contenu de la leçon ici.'
--   );
--
-- Pour une leçon vidéo : content_type = 'video' et video_url = l'URL
-- du fichier vidéo (hébergé où tu veux, tant que l'URL est publique).
-- "position" détermine l'ordre d'affichage (1, 2, 3...).
-- ============================================================
