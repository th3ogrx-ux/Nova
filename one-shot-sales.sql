-- ============================================================
-- NOVA / ZENOA — Ventes one-shot (résultat total de l'agence)
-- À coller dans Supabase Dashboard > SQL Editor > Run
-- Ré-exécutable sans risque.
-- ============================================================

create table if not exists public.one_shot_sales (
  id           uuid primary key default gen_random_uuid(),
  client_name  text not null,
  description  text,
  amount       numeric not null default 0,
  sale_date    date not null default current_date,
  created_by   uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now()
);

alter table public.one_shot_sales enable row level security;

drop policy if exists "one_shot_sales_select" on public.one_shot_sales;
create policy "one_shot_sales_select" on public.one_shot_sales
  for select using (auth.uid() is not null);

drop policy if exists "one_shot_sales_write" on public.one_shot_sales;
create policy "one_shot_sales_write" on public.one_shot_sales
  for all using (public.is_chef()) with check (public.is_chef());

grant select, insert, update, delete on public.one_shot_sales to authenticated;

alter publication supabase_realtime add table public.one_shot_sales;
