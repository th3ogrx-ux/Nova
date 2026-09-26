-- ============================================================
-- NOVA — Ressources (dossiers créés par le chef, lecture pour tous)
-- À coller dans Supabase Dashboard > SQL Editor > Run
-- ============================================================

create table if not exists public.resource_categories (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.resource_items (
  id          uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.resource_categories(id) on delete cascade,
  content     text not null,
  created_by  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table public.resource_categories enable row level security;
alter table public.resource_items enable row level security;

drop policy if exists "resource_categories_select" on public.resource_categories;
create policy "resource_categories_select" on public.resource_categories
  for select using (auth.uid() is not null);

drop policy if exists "resource_categories_write" on public.resource_categories;
create policy "resource_categories_write" on public.resource_categories
  for all using (public.is_chef()) with check (public.is_chef());

drop policy if exists "resource_items_select" on public.resource_items;
create policy "resource_items_select" on public.resource_items
  for select using (auth.uid() is not null);

drop policy if exists "resource_items_write" on public.resource_items;
create policy "resource_items_write" on public.resource_items
  for all using (public.is_chef()) with check (public.is_chef());

alter publication supabase_realtime add table public.resource_categories;
alter publication supabase_realtime add table public.resource_items;
