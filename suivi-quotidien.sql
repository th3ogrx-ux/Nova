-- ============================================================================
-- Zenoa Agency — Suivi quotidien de prospection (page Offres > Suivi quotidien)
-- SQL Editor > New query > coller > Run. Ne touche à aucune ancienne table.
-- Une ligne par jour : prospectés Google, prospectés Instagram, réponses, audits envoyés, ventes.
-- ============================================================================
create table if not exists public.suivi_jours (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  jour       date not null,
  google     integer not null default 0 check (google between 0 and 100000),
  instagram  integer not null default 0 check (instagram between 0 and 100000),
  reponses   integer not null default 0 check (reponses between 0 and 100000),
  audits     integer not null default 0 check (audits between 0 and 100000),
  ventes     integer not null default 0 check (ventes between 0 and 100000),
  updated_at timestamptz not null default now(),
  unique (user_id, jour)
);
create index if not exists suivi_jours_idx on public.suivi_jours (user_id, jour);

alter table public.suivi_jours enable row level security;
revoke all on public.suivi_jours from anon, authenticated;
grant select, insert, update, delete on public.suivi_jours to authenticated;

drop policy if exists "mes lignes" on public.suivi_jours;
create policy "mes lignes" on public.suivi_jours for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "acces sur invitation" on public.suivi_jours;
create policy "acces sur invitation" on public.suivi_jours as restrictive for all to authenticated
  using (public.espace_admin_ok()) with check (public.espace_admin_ok());

-- Membres de l'équipe : selon la permission « Offres / prospection » de leur rôle.
do $$
begin
  if to_regprocedure('public.has_perm(text,text)') is null then
    raise notice 'equipe.sql absent : accès des membres non créé (relance ce fichier après equipe.sql).';
    return;
  end if;
  drop policy if exists "equipe lecture" on public.suivi_jours;
  drop policy if exists "equipe ajout" on public.suivi_jours;
  drop policy if exists "equipe modification" on public.suivi_jours;
  drop policy if exists "equipe suppression" on public.suivi_jours;
  create policy "equipe lecture" on public.suivi_jours for select to authenticated
    using (user_id = public.team_owner() and public.has_perm('prospection', 'view'));
  create policy "equipe ajout" on public.suivi_jours for insert to authenticated
    with check (user_id = public.team_owner() and public.has_perm('prospection', 'edit'));
  create policy "equipe modification" on public.suivi_jours for update to authenticated
    using (user_id = public.team_owner() and public.has_perm('prospection', 'edit'))
    with check (user_id = public.team_owner() and public.has_perm('prospection', 'edit'));
  create policy "equipe suppression" on public.suivi_jours for delete to authenticated
    using (user_id = public.team_owner() and public.has_perm('prospection', 'delete'));
end $$;

notify pgrst, 'reload schema';
