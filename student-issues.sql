-- ============================================================
-- NOVA / ZENOA — Problèmes rencontrés par chaque élève.
-- Accès entièrement réservé au chef : les élèves ne voient ni ne
-- renseignent rien ici, c'est le chef qui note chaque problème depuis
-- la fiche élève (Élèves > un élève > badge "X problèmes").
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

create table if not exists public.student_issues (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  description text not null,
  created_at  timestamptz not null default now()
);

create index if not exists student_issues_user_id_idx
  on public.student_issues (user_id);

alter table public.student_issues enable row level security;

drop policy if exists "admin can manage issues" on public.student_issues;
create policy "admin can manage issues" on public.student_issues
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.student_issues to authenticated;

notify pgrst, 'reload schema';
