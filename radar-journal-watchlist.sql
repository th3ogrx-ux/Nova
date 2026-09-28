-- ZENOA — liste des personnes suivies dans "Activité de l'équipe"
-- du Journal de Zenoa Radar (le chef choisit qui apparaît, pas tout
-- le monde automatiquement).

create table if not exists public.radar_journal_watchlist (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  added_at   timestamptz not null default now()
);

alter table public.radar_journal_watchlist enable row level security;

drop policy if exists "radar_journal_watchlist_select" on public.radar_journal_watchlist;
create policy "radar_journal_watchlist_select" on public.radar_journal_watchlist
  for select to authenticated using (true);

drop policy if exists "radar_journal_watchlist_write_chef" on public.radar_journal_watchlist;
create policy "radar_journal_watchlist_write_chef" on public.radar_journal_watchlist
  for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'chef'))
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'chef'));

grant select, insert, delete on public.radar_journal_watchlist to authenticated;
