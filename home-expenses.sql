-- ============================================================
-- NOVA / ZENOA — Dépenses (carte "Compta" page d'accueil)
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

create table if not exists public.home_expenses (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  amount       numeric not null default 0,
  entry_date   date not null default current_date,
  created_by   uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now()
);

alter table public.home_expenses enable row level security;

drop policy if exists "home_expenses_select" on public.home_expenses;
create policy "home_expenses_select" on public.home_expenses
  for select using (auth.uid() is not null);

drop policy if exists "home_expenses_write" on public.home_expenses;
create policy "home_expenses_write" on public.home_expenses
  for all using (public.is_chef()) with check (public.is_chef());

grant select, insert, update, delete on public.home_expenses to authenticated;

alter publication supabase_realtime add table public.home_expenses;
