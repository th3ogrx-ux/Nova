-- ZENOA — liste des personnes autorisées à ajouter des prospects dans
-- Journal de DMs (le chef choisit qui, pas tout le monde par défaut).

create table if not exists public.dm_journal_watchlist (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  added_at   timestamptz not null default now()
);

alter table public.dm_journal_watchlist enable row level security;

drop policy if exists "dm_journal_watchlist_select" on public.dm_journal_watchlist;
create policy "dm_journal_watchlist_select" on public.dm_journal_watchlist
  for select to authenticated using (true);

drop policy if exists "dm_journal_watchlist_write_chef" on public.dm_journal_watchlist;
create policy "dm_journal_watchlist_write_chef" on public.dm_journal_watchlist
  for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'chef'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'chef'));

grant select, insert, delete on public.dm_journal_watchlist to authenticated;
