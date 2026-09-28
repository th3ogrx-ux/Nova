-- ============================================================
-- ZENOA — Ressources privées du chef (Gestion > Ressources)
-- Stockage de liens/notes visibles uniquement par le chef.
-- À coller dans Supabase Dashboard > SQL Editor > Run
-- Ré-exécutable sans risque.
-- ============================================================

create table if not exists public.admin_links (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  url        text,
  note       text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create index if not exists admin_links_created_idx
  on public.admin_links (created_at desc);

alter table public.admin_links enable row level security;

drop policy if exists "admin_links_all_chef" on public.admin_links;
create policy "admin_links_all_chef" on public.admin_links
  for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'chef')
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'chef')
  );

grant select, insert, update, delete on public.admin_links to authenticated;
