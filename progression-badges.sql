-- ============================================================
-- NOVA / ZENOA — Page Progression : badges + "streak" (jours
-- d'affilée) pour le badge "7 jours d'affilée".
-- La progression des leçons/modules réutilise les tables créées par
-- cours-content.sql (course_modules, course_lessons,
-- user_lesson_progress) — rien de nouveau à créer pour ça.
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque (sauf le bloc de données de test, à ne
-- coller qu'une seule fois — voir la note plus bas).
-- ============================================================

-- "Streak" : compteur de jours de visite d'affilée (en date
-- Europe/Paris), mis à jour automatiquement par l'app à chaque
-- connexion (voir updateStreak() dans chat-widget.js).
alter table public.profiles
  add column if not exists streak_count int not null default 0,
  add column if not exists streak_last_date date;

-- ----- Badges (définitions, les mêmes pour tout le monde) -----
create table if not exists public.badges (
  code text primary key,
  position int not null,
  icon text not null,
  label text not null,
  condition_text text not null
);

-- ----- Badges débloqués par élève -----
create table if not exists public.user_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_code text not null references public.badges(code) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, badge_code)
);

alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

drop policy if exists "authenticated can read badges" on public.badges;
create policy "authenticated can read badges" on public.badges
  for select to authenticated using (true);

drop policy if exists "user can read own badges" on public.user_badges;
create policy "user can read own badges" on public.user_badges
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "user can insert own badges" on public.user_badges;
create policy "user can insert own badges" on public.user_badges
  for insert to authenticated with check (user_id = auth.uid());

-- ============================================================
-- Les 4 badges demandés. Ne coller qu'UNE SEULE FOIS (ou utilise "on
-- conflict do nothing" déjà présent ci-dessous, qui rend ce bloc
-- ré-exécutable sans risque de doublon, contrairement aux autres
-- blocs de données de test de ce projet).
--
-- IMPORTANT : la condition de déblocage de chaque badge (quand il
-- devient débloqué) est du CODE, dans chat-widget.js, fonction
-- badgeConditionMet() — le texte ci-dessous (condition_text) n'est
-- que l'affichage, le modifier ici ne change pas la vraie condition.
-- Les 4 codes gérés dans le code sont : first_lesson, module1_done,
-- first_submission, streak7. Pour ajouter un 5e badge avec une
-- nouvelle condition, il faut aussi ajouter sa condition dans
-- badgeConditionMet() (demande-le-moi).
-- ============================================================

insert into public.badges (code, position, icon, label, condition_text) values
  ('first_lesson', 1, '🎯', 'Première leçon', 'Termine ta première leçon.'),
  ('module1_done', 2, '📘', 'Module 1 terminé', 'Termine toutes les leçons du module 1.'),
  ('first_submission', 3, '📤', 'Premier dépôt', 'Dépose ton premier travail dans Mon projet.'),
  ('streak7', 4, '🔥', '7 jours d''affilée', 'Reviens sur l''app 7 jours de suite.')
on conflict (code) do nothing;
