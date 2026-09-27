-- ============================================================
-- ZENOA — Calendrier partagé (points d'avancement)
-- À coller dans Supabase Dashboard > SQL Editor > Run
-- Ré-exécutable sans risque.
-- ============================================================

create table if not exists public.calendar_events (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  description text,
  event_date  date not null,
  event_time  time,
  created_at  timestamptz not null default now()
);

create index if not exists calendar_events_date_idx
  on public.calendar_events (event_date);

alter table public.calendar_events enable row level security;

-- Lecture : tout le monde (membres connectés) voit tous les points.
drop policy if exists "calendar_events_select" on public.calendar_events;
create policy "calendar_events_select" on public.calendar_events
  for select using (true);

-- Création : uniquement en son propre nom.
drop policy if exists "calendar_events_insert" on public.calendar_events;
create policy "calendar_events_insert" on public.calendar_events
  for insert with check (created_by = auth.uid());

-- Suppression : uniquement ses propres points.
drop policy if exists "calendar_events_delete" on public.calendar_events;
create policy "calendar_events_delete" on public.calendar_events
  for delete using (created_by = auth.uid());

grant select, insert, delete on public.calendar_events to authenticated;

alter publication supabase_realtime add table public.calendar_events;
