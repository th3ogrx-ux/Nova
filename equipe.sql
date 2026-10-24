-- ============================================================================
-- Zenoa Agency — Équipe, rôles et permissions (à coller dans Supabase > SQL Editor > Run, relançable sans risque)
-- À lancer APRÈS espace.sql, securite.sql, prospection.sql et audits.sql.
-- Principe : les membres de l'équipe travaillent sur TES données (celles de l'admin), selon les cases cochées dans leur rôle.
-- Modules délégables : dashboard (ventes), radar, prospection, calendrier, audits. Niveaux : view, edit, delete.
-- Clients, Messages, Équipe et Rôles restent réservés à l'admin.
-- ============================================================================

create table if not exists public.team_roles (
  id         uuid primary key default gen_random_uuid(),
  nom        text not null check (char_length(nom) between 1 and 40),
  perms      jsonb not null default '{}'::jsonb check (jsonb_typeof(perms) = 'object' and char_length(perms::text) <= 4000),
  created_at timestamptz not null default now()
);
create unique index if not exists team_roles_nom_idx on public.team_roles (lower(nom));

create table if not exists public.team_members (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  role_id    uuid references public.team_roles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Dernière activité de chaque personne connectée (mise à jour par touch_presence, jamais écrite directement).
create table if not exists public.team_presence (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  last_seen timestamptz not null default now()
);

-- ---------- Fonctions ----------
-- Qui a accès aux tables de travail : l'admin ET les membres de l'équipe (leurs droits précis viennent des politiques « equipe … »).
create or replace function public.espace_admin_ok()
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if exists (select 1 from public.espace_profiles where id = auth.uid() and role = 'admin') then return true; end if;
  if to_regclass('public.team_members') is null then return false; end if;
  return exists (select 1 from public.team_members where user_id = auth.uid());
end $$;
revoke all on function public.espace_admin_ok() from public;
grant execute on function public.espace_admin_ok() to authenticated;

create or replace function public.espace_access_ok()
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if exists (select 1 from public.espace_profiles where id = auth.uid() and role in ('admin', 'client')) then return true; end if;
  if to_regclass('public.team_members') is null then return false; end if;
  return exists (select 1 from public.team_members where user_id = auth.uid());
end $$;
revoke all on function public.espace_access_ok() from public;
grant execute on function public.espace_access_ok() to authenticated;

-- L'admin (propriétaire des données partagées).
create or replace function public.team_owner()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.espace_profiles where role = 'admin' order by created_at limit 1;
$$;
revoke all on function public.team_owner() from public;
grant execute on function public.team_owner() to authenticated;

-- Droits du membre connecté (null si ce n'est pas un membre).
create or replace function public.my_perms()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(r.perms, '{}'::jsonb) from public.team_members m left join public.team_roles r on r.id = m.role_id where m.user_id = auth.uid();
$$;
revoke all on function public.my_perms() from public;
grant execute on function public.my_perms() to authenticated;

-- Vrai pour l'admin ; pour un membre : « voir » doit être coché, puis le niveau demandé (view / edit / delete).
create or replace function public.has_perm(p_module text, p_level text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare p jsonb;
begin
  if exists (select 1 from public.espace_profiles where id = auth.uid() and role = 'admin') then return true; end if;
  p := public.my_perms();
  if p is null then return false; end if;
  return coalesce((p -> p_module ->> 'view')::boolean, false) and coalesce((p -> p_module ->> p_level)::boolean, false);
end $$;
revoke all on function public.has_perm(text, text) from public;
grant execute on function public.has_perm(text, text) to authenticated;

-- « Je suis là » : appelé toutes les minutes par l'appli pendant qu'elle est ouverte.
create or replace function public.touch_presence()
returns void language sql security definer set search_path = public as $$
  insert into public.team_presence (user_id, last_seen) values (auth.uid(), now())
  on conflict (user_id) do update set last_seen = excluded.last_seen
  where auth.uid() is not null;
$$;
revoke all on function public.touch_presence() from public, anon;
grant execute on function public.touch_presence() to authenticated;

-- ---------- Sécurité des nouvelles tables ----------
alter table public.team_roles enable row level security;
alter table public.team_members enable row level security;
alter table public.team_presence enable row level security;

revoke all on public.team_roles, public.team_members, public.team_presence from anon, authenticated;
grant select, insert, update, delete on public.team_roles to authenticated;
grant select, update (role_id), delete on public.team_members to authenticated;
grant select on public.team_presence to authenticated;

drop policy if exists "roles : admin" on public.team_roles;
create policy "roles : admin" on public.team_roles for all to authenticated using (public.espace_is_admin()) with check (public.espace_is_admin());
drop policy if exists "roles : le mien" on public.team_roles;
create policy "roles : le mien" on public.team_roles for select to authenticated
  using (id = (select m.role_id from public.team_members m where m.user_id = auth.uid()));

drop policy if exists "membres : admin" on public.team_members;
create policy "membres : admin" on public.team_members for all to authenticated using (public.espace_is_admin()) with check (public.espace_is_admin());
drop policy if exists "membres : moi" on public.team_members;
create policy "membres : moi" on public.team_members for select to authenticated using (user_id = auth.uid());

drop policy if exists "presence : admin" on public.team_presence;
create policy "presence : admin" on public.team_presence for select to authenticated using (public.espace_is_admin());

do $$
declare t text;
begin
  foreach t in array array['team_roles', 'team_members', 'team_presence'] loop
    execute format('drop policy if exists "acces sur invitation" on public.%I', t);
    execute format('create policy "acces sur invitation" on public.%I as restrictive for all to authenticated using (public.espace_admin_ok()) with check (public.espace_admin_ok())', t);
  end loop;
end $$;

-- ---------- Accès des membres aux données de l'admin, module par module ----------
do $$
declare r record;
begin
  for r in select * from (values
    ('radar_leads', 'radar'),
    ('pro_strategies', 'prospection'), ('pro_scripts', 'prospection'), ('pro_logs', 'prospection'), ('pro_prospects', 'prospection'),
    ('pro_offers', 'prospection'), ('pro_reviews', 'prospection'), ('pro_settings', 'prospection'),
    ('pro_videos', 'calendrier'),
    ('audits', 'audits'),
    ('sales', 'dashboard')
  ) as v(tbl, module) loop
    if to_regclass('public.' || r.tbl) is null then raise notice 'table % absente : ignorée', r.tbl; continue; end if;
    execute format('drop policy if exists "equipe lecture" on public.%I', r.tbl);
    execute format('drop policy if exists "equipe ajout" on public.%I', r.tbl);
    execute format('drop policy if exists "equipe modification" on public.%I', r.tbl);
    execute format('drop policy if exists "equipe suppression" on public.%I', r.tbl);
    execute format('create policy "equipe lecture" on public.%I for select to authenticated using (user_id = public.team_owner() and public.has_perm(%L, ''view''))', r.tbl, r.module);
    execute format('create policy "equipe ajout" on public.%I for insert to authenticated with check (user_id = public.team_owner() and public.has_perm(%L, ''edit''))', r.tbl, r.module);
    execute format('create policy "equipe modification" on public.%I for update to authenticated using (user_id = public.team_owner() and public.has_perm(%L, ''edit'')) with check (user_id = public.team_owner() and public.has_perm(%L, ''edit''))', r.tbl, r.module, r.module);
    execute format('create policy "equipe suppression" on public.%I for delete to authenticated using (user_id = public.team_owner() and public.has_perm(%L, ''delete''))', r.tbl, r.module);
  end loop;
end $$;

-- Vues d'un audit : lisibles par les membres qui peuvent voir les audits.
do $$
begin
  if to_regclass('public.audit_views') is not null then
    drop policy if exists "equipe vues" on public.audit_views;
    create policy "equipe vues" on public.audit_views for select to authenticated
      using (public.has_perm('audits', 'view') and exists (select 1 from public.audits a where a.id = audit_id and a.user_id = public.team_owner()));
  end if;
end $$;

-- Images des audits (bucket user-resources, dossier <admin>/audits/…) : lisibles par les membres qui voient les audits.
do $$
begin
  execute 'drop policy if exists "equipe : images des audits" on storage.objects';
  execute $p$create policy "equipe : images des audits" on storage.objects for select to authenticated
    using (bucket_id = 'user-resources' and (storage.foldername(name))[1] = public.team_owner()::text and (storage.foldername(name))[2] = 'audits' and public.has_perm('audits', 'view'))$p$;
exception when others then
  raise notice 'storage.objects : politique non créée (%). À ajouter à la main si besoin.', sqlerrm;
end $$;

notify pgrst, 'reload schema';
