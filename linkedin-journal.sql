-- ============================================================
-- ZENOA — Journal LinkedIn (même principe que Journal de DMs :
-- watchlist gérée par le chef, seuls les gens ajoutés + le chef
-- peuvent y écrire).
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

create table if not exists public.linkedin_prospects (
  id         uuid primary key default gen_random_uuid(),
  setter_id  uuid not null references public.profiles(id) on delete cascade,
  contact    text not null,
  secteur    text,
  date       date not null default current_date,
  status     text not null default 'sent'
             check (status in ('sent', 'replied', 'meeting', 'interested', 'sold', 'not_interested')),
  created_at timestamptz not null default now()
);

create index if not exists linkedin_prospects_setter_idx on public.linkedin_prospects (setter_id);

alter table public.linkedin_prospects enable row level security;

-- Toute l'équipe connectée peut lire le journal (comme prospects/DM) ;
-- le widget filtre côté client pour qu'un membre ne voie que ses
-- propres lignes, seul le chef voit tout le monde.
drop policy if exists "linkedin_prospects_select" on public.linkedin_prospects;
create policy "linkedin_prospects_select" on public.linkedin_prospects
  for select to authenticated using (true);

drop policy if exists "linkedin_prospects_insert_own" on public.linkedin_prospects;
create policy "linkedin_prospects_insert_own" on public.linkedin_prospects
  for insert
  with check (
    setter_id = auth.uid()
    and is_active_user()
    and (
      is_chef()
      or exists (select 1 from public.linkedin_journal_watchlist where profile_id = auth.uid())
    )
  );

drop policy if exists "linkedin_prospects_update_own" on public.linkedin_prospects;
create policy "linkedin_prospects_update_own" on public.linkedin_prospects
  for update
  using (setter_id = auth.uid() or is_chef())
  with check (setter_id = auth.uid() or is_chef());

drop policy if exists "linkedin_prospects_delete_own" on public.linkedin_prospects;
create policy "linkedin_prospects_delete_own" on public.linkedin_prospects
  for delete
  using (setter_id = auth.uid() or is_chef());

-- Liste des personnes autorisées à ajouter des prospects dans
-- Journal LinkedIn (le chef choisit qui, pas tout le monde par défaut).
create table if not exists public.linkedin_journal_watchlist (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  added_at   timestamptz not null default now()
);

alter table public.linkedin_journal_watchlist enable row level security;

drop policy if exists "linkedin_journal_watchlist_select" on public.linkedin_journal_watchlist;
create policy "linkedin_journal_watchlist_select" on public.linkedin_journal_watchlist
  for select to authenticated using (true);

drop policy if exists "linkedin_journal_watchlist_write_chef" on public.linkedin_journal_watchlist;
create policy "linkedin_journal_watchlist_write_chef" on public.linkedin_journal_watchlist
  for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'chef'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'chef'));

grant select, insert, update, delete on public.linkedin_prospects to authenticated;
grant select, insert, delete on public.linkedin_journal_watchlist to authenticated;
