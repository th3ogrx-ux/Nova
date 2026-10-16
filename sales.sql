-- ============================================================
-- ZENOA RADAR — Ventes (carte "Ventes" du Tableau de bord)
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

create table if not exists public.sales (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  client     text check (char_length(client) <= 200),
  amount     numeric(12, 2) not null check (amount > 0),
  sold_on    date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists sales_user_sold_on_idx on public.sales (user_id, sold_on);

alter table public.sales enable row level security;

drop policy if exists "user can manage own sales" on public.sales;
create policy "user can manage own sales" on public.sales
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, delete on public.sales to authenticated;

notify pgrst, 'reload schema';
