-- ============================================================
-- NOVA / ZENOA — Tâches assignées par le chef à chaque élève.
-- Remplace "Mes étapes" (qui utilisait un template partagé
-- project_steps/user_project_steps) : désormais le chef définit, pour
-- chaque élève individuellement, les tâches à faire depuis la fiche
-- élève (Élèves > un élève > Tâches). L'élève les voit dans Mon
-- projet et peut juste les cocher, le chef les ajoute/supprime.
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

create table if not exists public.student_tasks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  label       text not null,
  done        boolean not null default false,
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists student_tasks_user_id_idx
  on public.student_tasks (user_id);

alter table public.student_tasks enable row level security;

-- Lecture : l'élève voit ses propres tâches, le chef voit tout.
drop policy if exists "student_tasks_select" on public.student_tasks;
create policy "student_tasks_select" on public.student_tasks
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- Coche/décoche : l'élève met à jour ses propres tâches (en pratique
-- seul le champ "done" est modifié côté interface), le chef peut tout
-- modifier.
drop policy if exists "student_tasks_update" on public.student_tasks;
create policy "student_tasks_update" on public.student_tasks
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

-- Ajout/suppression : réservés au chef (c'est lui qui assigne les
-- tâches, l'élève ne peut pas en créer ou en retirer).
drop policy if exists "student_tasks_insert" on public.student_tasks;
create policy "student_tasks_insert" on public.student_tasks
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "student_tasks_delete" on public.student_tasks;
create policy "student_tasks_delete" on public.student_tasks
  for delete to authenticated
  using (public.is_admin());

grant select, update, insert, delete on public.student_tasks to authenticated;

notify pgrst, 'reload schema';
