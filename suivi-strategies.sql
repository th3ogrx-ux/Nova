-- ============================================================================
-- Zenoa Agency — Suivi quotidien par STRATÉGIE (Offres > Suivi quotidien)
-- SQL Editor > New query > coller > Run. Relançable sans risque. N'efface rien :
-- tes anciens chiffres (table suivi_jours) sont copiés dans une ligne « Sans stratégie ».
-- ============================================================================
create table if not exists public.suivi_strategies (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nom        text not null check (char_length(nom) between 1 and 80),
  note       text check (char_length(note) <= 500),     -- en quoi consiste la stratégie (message, cible)
  systeme    boolean not null default false,            -- « Sans stratégie » : ni renommée ni supprimée
  position   integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, nom)
);

create table if not exists public.suivi_lignes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users(id) on delete cascade,
  jour         date not null,
  strategie_id uuid not null references public.suivi_strategies(id) on delete cascade,
  dm           integer not null default 0 check (dm between 0 and 100000),
  reponses     integer not null default 0 check (reponses between 0 and 100000),
  audits       integer not null default 0 check (audits between 0 and 100000),
  offres       integer not null default 0 check (offres between 0 and 100000),
  ventes       integer not null default 0 check (ventes between 0 and 100000),
  updated_at   timestamptz not null default now(),
  unique (user_id, jour, strategie_id)
);
create index if not exists suivi_lignes_idx on public.suivi_lignes (user_id, jour);

-- Une ligne ne peut viser que SA stratégie.
create or replace function public.suivi_lignes_check() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.suivi_strategies s where s.id = new.strategie_id and s.user_id = new.user_id) then
    raise exception 'Stratégie inconnue';
  end if;
  return new;
end $$;
drop trigger if exists suivi_lignes_check on public.suivi_lignes;
create trigger suivi_lignes_check before insert or update on public.suivi_lignes for each row execute function public.suivi_lignes_check();

do $$
declare t text;
begin
  foreach t in array array['suivi_strategies', 'suivi_lignes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "mes lignes" on public.%I', t);
    execute format('create policy "mes lignes" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('drop policy if exists "acces sur invitation" on public.%I', t);
    execute format('create policy "acces sur invitation" on public.%I as restrictive for all to authenticated using (public.espace_admin_ok()) with check (public.espace_admin_ok())', t);
    if to_regprocedure('public.has_perm(text,text)') is not null then
      execute format('drop policy if exists "equipe lecture" on public.%I', t);
      execute format('drop policy if exists "equipe ajout" on public.%I', t);
      execute format('drop policy if exists "equipe modification" on public.%I', t);
      execute format('drop policy if exists "equipe suppression" on public.%I', t);
      execute format('create policy "equipe lecture" on public.%I for select to authenticated using (user_id = public.team_owner() and public.has_perm(''prospection'', ''view''))', t);
      execute format('create policy "equipe ajout" on public.%I for insert to authenticated with check (user_id = public.team_owner() and public.has_perm(''prospection'', ''edit''))', t);
      execute format('create policy "equipe modification" on public.%I for update to authenticated using (user_id = public.team_owner() and public.has_perm(''prospection'', ''edit'')) with check (user_id = public.team_owner() and public.has_perm(''prospection'', ''edit''))', t);
      execute format('create policy "equipe suppression" on public.%I for delete to authenticated using (user_id = public.team_owner() and public.has_perm(''prospection'', ''delete''))', t);
    end if;
  end loop;
end $$;

-- ---------- Départ : « Sans stratégie » (anciens chiffres) + Insta 1, 2, 3 ----------
do $$
declare v_admin uuid; v_none uuid;
begin
  select id into v_admin from public.espace_profiles where role = 'admin' order by created_at limit 1;
  if v_admin is null then raise notice 'Aucun admin trouvé : stratégies de départ non créées.'; return; end if;

  insert into public.suivi_strategies (user_id, nom, note, systeme, position)
    values (v_admin, 'Sans stratégie', 'Chiffres saisis avant l''arrivée des stratégies.', true, 999)
    on conflict (user_id, nom) do nothing;
  select id into v_none from public.suivi_strategies where user_id = v_admin and systeme limit 1;

  if to_regclass('public.suivi_jours') is not null then
    insert into public.suivi_lignes (user_id, jour, strategie_id, dm, reponses, audits, ventes)
      select user_id, jour, v_none, least(google + instagram, 100000), reponses, audits, ventes
      from public.suivi_jours where user_id = v_admin
      on conflict (user_id, jour, strategie_id) do nothing;
  end if;

  if not exists (select 1 from public.suivi_strategies where user_id = v_admin and not systeme) then
    insert into public.suivi_strategies (user_id, nom, note, position) values
      (v_admin, 'Insta 1', null, 0), (v_admin, 'Insta 2', null, 1), (v_admin, 'Insta 3', null, 2)
      on conflict (user_id, nom) do nothing;
  end if;
end $$;

notify pgrst, 'reload schema';
