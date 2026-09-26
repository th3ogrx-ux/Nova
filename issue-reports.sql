-- ============================================================
-- NOVA — Signalements de problèmes (envoi pour tous, lecture chef uniquement)
-- À coller dans Supabase Dashboard > SQL Editor > Run
-- ============================================================

create table if not exists public.issue_reports (
  id         uuid primary key default gen_random_uuid(),
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now(),
  read_at    timestamptz
);

alter table public.issue_reports enable row level security;

drop policy if exists "issue_reports_insert" on public.issue_reports;
create policy "issue_reports_insert" on public.issue_reports
  for insert with check (sender_id = auth.uid());

drop policy if exists "issue_reports_select" on public.issue_reports;
create policy "issue_reports_select" on public.issue_reports
  for select using (public.is_chef());

drop policy if exists "issue_reports_update" on public.issue_reports;
create policy "issue_reports_update" on public.issue_reports
  for update using (public.is_chef()) with check (public.is_chef());

grant select, insert, update on public.issue_reports to authenticated;

alter publication supabase_realtime add table public.issue_reports;
