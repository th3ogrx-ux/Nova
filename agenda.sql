-- ============================================================================
-- Zenoa Agency — Calendrier : les choses importantes de chaque prospect et de chaque mannequin
-- (SQL Editor > New query > coller > Run). Ne touche à aucune ancienne table.
-- Prérequis : securite.sql (espace_admin_ok), equipe.sql (team_owner, has_perm).
-- ============================================================================
create table if not exists public.agenda_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  jour        date not null,
  heure       text check (heure ~ '^[0-2][0-9]:[0-5][0-9]$'),
  titre       text not null check (char_length(titre) between 1 and 160),
  type        text not null default 'rdv' check (type in ('rdv','appel','relance','livrable','shooting','paiement','autre')),
  kind        text not null default 'autre' check (kind in ('client','prospect','autre')),
  business_id uuid references public.espace_businesses(id) on delete cascade,
  prospect    text check (char_length(prospect) <= 120),
  note        text check (char_length(note) <= 2000),
  fait        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists agenda_events_idx on public.agenda_events (user_id, jour);
create index if not exists agenda_events_biz on public.agenda_events (business_id);

alter table public.agenda_events enable row level security;
revoke all on public.agenda_events from anon, authenticated;
grant select, insert, update, delete on public.agenda_events to authenticated;

drop policy if exists "mes lignes" on public.agenda_events;
create policy "mes lignes" on public.agenda_events for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "acces sur invitation" on public.agenda_events;
create policy "acces sur invitation" on public.agenda_events as restrictive for all to authenticated
  using (public.espace_admin_ok()) with check (public.espace_admin_ok());

-- Membres de l'équipe : selon la permission « Calendrier » de leur rôle.
do $$
begin
  if to_regprocedure('public.has_perm(text,text)') is null then
    raise notice 'equipe.sql absent : accès des membres non créé (relance ce fichier après equipe.sql).';
    return;
  end if;
  drop policy if exists "equipe lecture" on public.agenda_events;
  drop policy if exists "equipe ajout" on public.agenda_events;
  drop policy if exists "equipe modification" on public.agenda_events;
  drop policy if exists "equipe suppression" on public.agenda_events;
  create policy "equipe lecture" on public.agenda_events for select to authenticated
    using (user_id = public.team_owner() and public.has_perm('calendrier', 'view'));
  create policy "equipe ajout" on public.agenda_events for insert to authenticated
    with check (user_id = public.team_owner() and public.has_perm('calendrier', 'edit'));
  create policy "equipe modification" on public.agenda_events for update to authenticated
    using (user_id = public.team_owner() and public.has_perm('calendrier', 'edit'))
    with check (user_id = public.team_owner() and public.has_perm('calendrier', 'edit'));
  create policy "equipe suppression" on public.agenda_events for delete to authenticated
    using (user_id = public.team_owner() and public.has_perm('calendrier', 'delete'));
end $$;

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- FACULTATIF et IRRÉVERSIBLE (à lancer seulement si tu veux effacer l'ancien calendrier de vidéos) :
-- drop table if exists public.pro_videos;
-- ---------------------------------------------------------------------------
