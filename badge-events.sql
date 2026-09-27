-- ============================================================
-- NOVA / ZENOA — Historique des badges débloqués (pour les
-- notifications du chef)
-- À coller dans Supabase Dashboard > SQL Editor > Run
-- Ré-exécutable sans risque.
-- ============================================================

create table if not exists public.badge_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  badge_id   text not null,
  created_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

alter table public.badge_events enable row level security;

drop policy if exists "badge_events_select" on public.badge_events;
create policy "badge_events_select" on public.badge_events
  for select using (auth.uid() is not null);

drop policy if exists "badge_events_insert" on public.badge_events;
create policy "badge_events_insert" on public.badge_events
  for insert with check (user_id = auth.uid());

grant select, insert on public.badge_events to authenticated;

alter publication supabase_realtime add table public.badge_events;
