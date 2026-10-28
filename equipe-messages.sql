-- ============================================================================
-- Zenoa Agency — Messages avec les membres de l'équipe ET les partenaires (SQL Editor > New query > coller > Run).
-- À lancer APRÈS equipe.sql. Ne touche à aucune ancienne table.
-- Chaque membre a UNE conversation avec toi (l'admin). Il ne voit que la sienne ; toi tu les vois toutes.
-- ============================================================================
create table if not exists public.team_messages (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.team_members(user_id) on delete cascade,
  auteur     text not null check (auteur in ('admin', 'membre')),
  texte      text not null check (char_length(texte) between 1 and 4000),
  lu         boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists team_messages_idx on public.team_messages (member_id, created_at);

alter table public.team_messages enable row level security;
revoke all on public.team_messages from anon, authenticated;
grant select, insert, update, delete on public.team_messages to authenticated;

drop policy if exists "admin gère les messages d'équipe" on public.team_messages;
create policy "admin gère les messages d'équipe" on public.team_messages
  for all to authenticated using (public.espace_is_admin()) with check (public.espace_is_admin());
drop policy if exists "membre lit sa conversation" on public.team_messages;
create policy "membre lit sa conversation" on public.team_messages
  for select to authenticated using (member_id = auth.uid());
drop policy if exists "membre écrit dans sa conversation" on public.team_messages;
create policy "membre écrit dans sa conversation" on public.team_messages
  for insert to authenticated
  with check (member_id = auth.uid() and auteur = 'membre' and lu = false);
drop policy if exists "acces sur invitation" on public.team_messages;
create policy "acces sur invitation" on public.team_messages as restrictive for all to authenticated
  using (public.espace_admin_ok()) with check (public.espace_admin_ok());

-- « Lu » : le membre ne peut pas modifier les lignes, il passe par cette fonction.
create or replace function public.team_mark_read(p_member_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.espace_is_admin() then
    update public.team_messages set lu = true where member_id = p_member_id and auteur = 'membre' and lu = false;
  else
    update public.team_messages set lu = true where member_id = auth.uid() and auteur = 'admin' and lu = false;
  end if;
end $$;
revoke all on function public.team_mark_read(uuid) from public;
grant execute on function public.team_mark_read(uuid) to authenticated;


-- ---------- Partenaires qui ont un compte : une conversation chacun avec toi ----------
create table if not exists public.partner_messages (
  id              uuid primary key default gen_random_uuid(),
  partner_user_id uuid not null references auth.users(id) on delete cascade,
  auteur          text not null check (auteur in ('admin', 'partenaire')),
  texte           text not null check (char_length(texte) between 1 and 4000),
  lu              boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists partner_messages_idx on public.partner_messages (partner_user_id, created_at);

alter table public.partner_messages enable row level security;
revoke all on public.partner_messages from anon, authenticated;
grant select, insert, update, delete on public.partner_messages to authenticated;

drop policy if exists "admin gère les messages partenaires" on public.partner_messages;
create policy "admin gère les messages partenaires" on public.partner_messages
  for all to authenticated using (public.espace_is_admin()) with check (public.espace_is_admin());
drop policy if exists "partenaire lit sa conversation" on public.partner_messages;
create policy "partenaire lit sa conversation" on public.partner_messages
  for select to authenticated
  using (partner_user_id = auth.uid() and exists (select 1 from public.espace_partners p where p.user_id = auth.uid()));
drop policy if exists "partenaire écrit dans sa conversation" on public.partner_messages;
create policy "partenaire écrit dans sa conversation" on public.partner_messages
  for insert to authenticated
  with check (partner_user_id = auth.uid() and auteur = 'partenaire' and lu = false
              and exists (select 1 from public.espace_partners p where p.user_id = auth.uid()));
drop policy if exists "acces sur invitation" on public.partner_messages;
create policy "acces sur invitation" on public.partner_messages as restrictive for all to authenticated
  using (public.espace_access_ok()) with check (public.espace_access_ok());

create or replace function public.partner_mark_read(p_partner_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.espace_is_admin() then
    update public.partner_messages set lu = true where partner_user_id = p_partner_id and auteur = 'partenaire' and lu = false;
  else
    update public.partner_messages set lu = true where partner_user_id = auth.uid() and auteur = 'admin' and lu = false;
  end if;
end $$;
revoke all on function public.partner_mark_read(uuid) from public;
grant execute on function public.partner_mark_read(uuid) to authenticated;

notify pgrst, 'reload schema';
