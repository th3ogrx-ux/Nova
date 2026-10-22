-- ZENOA — DURCISSEMENT SÉCURITÉ
-- À coller dans Supabase > SQL Editor > Run, APRÈS espace.sql. Peut être relancé sans risque.
--
-- Ce que ça fait :
--  1. Accès sur invitation : un compte sans profil (inscription sauvage) ne peut plus
--     lire ni écrire AUCUNE table, même s'il arrive à se créer un compte.
--  2. Double authentification obligatoire pour l'admin : tant qu'il n'a pas validé son
--     code à 6 chiffres (niveau "aal2"), la base lui refuse tout.
--  3. Journal de sécurité (audit_log) + verrouillage temporaire après des échecs de connexion.
--  4. Contraintes de format (liens http(s) uniquement, longueurs).
--  5. RGPD : export des données d'un client, purge automatique des vieilles données.
--
-- ⚠️ Avant de lancer : enregistre d'abord la double authentification de ton compte admin
--    (Paramètres > Double authentification), sinon tu seras bloqué à l'écran d'activation
--    (rien n'est perdu : tu l'actives, et tout revient).

-- ---------- 1 + 2. Qui a le droit d'accéder à la base ----------
-- Admin  : seulement avec la double authentification validée dans cette session.
-- Client : toujours (ses droits précis sont dans les politiques espace_*).
-- Sans profil : jamais.
create or replace function public.espace_access_ok()
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from public.espace_profiles where id = auth.uid() and role = 'admin')
      then coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    when exists (select 1 from public.espace_profiles where id = auth.uid() and role = 'client')
      then true
    else false
  end;
$$;
revoke all on function public.espace_access_ok() from public;
grant execute on function public.espace_access_ok() to authenticated;

-- L'admin n'est "admin" pour les politiques espace_* qu'avec la double authentification.
create or replace function public.espace_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.espace_profiles where id = auth.uid() and role = 'admin')
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

-- Tables de travail de l'agence (Radar, CRM, ventes, ressources...) : l'admin avec 2FA seulement.
-- Un client n'y a aucune ligne, et ne peut pas non plus en créer.
create or replace function public.espace_admin_ok()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.espace_profiles where id = auth.uid() and role = 'admin')
     and coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;
revoke all on function public.espace_admin_ok() from public;
grant execute on function public.espace_admin_ok() to authenticated;

-- Politique "restrictive" sur chaque table : elle s'ajoute (ET) aux politiques existantes.
-- Tables ouvertes aux clients (leurs données + leur profil) : espace_*, user_profiles, demo_sites, audit_log.
-- Toutes les autres : espace_admin_ok(). espace_profiles en est exclue : l'appli doit pouvoir lire son propre rôle pour savoir
-- s'il faut demander l'activation ou le code de la double authentification.
do $$
declare t record;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> 'espace_profiles'
  loop
    execute format('drop policy if exists "acces sur invitation + 2FA admin" on public.%I', t.tablename);
    execute format(
      'create policy "acces sur invitation + 2FA admin" on public.%I as restrictive for all to authenticated using (public.%s()) with check (public.%s())',
      t.tablename,
      case when t.tablename like 'espace\_%' or t.tablename in ('user_profiles', 'demo_sites', 'audit_log') then 'espace_access_ok' else 'espace_admin_ok' end,
      case when t.tablename like 'espace\_%' or t.tablename in ('user_profiles', 'demo_sites', 'audit_log') then 'espace_access_ok' else 'espace_admin_ok' end);
  end loop;
end $$;

-- Même règle pour les fichiers (avatars, ressources). Ignoré si le projet l'interdit.
do $$
begin
  execute 'drop policy if exists "acces sur invitation + 2FA admin" on storage.objects';
  execute 'create policy "acces sur invitation + 2FA admin" on storage.objects as restrictive for all to authenticated using (public.espace_access_ok()) with check (public.espace_access_ok())';
exception when others then
  raise notice 'storage.objects : politique non créée (%). À ajouter à la main si besoin.', sqlerrm;
end $$;

-- ---------- 3. Journal de sécurité ----------
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  type        text not null check (type in (
                'login_failed','login_success','access_denied','mfa_enrolled','mfa_removed',
                'password_changed','client_created','client_deleted','client_password_reset',
                'data_exported','purge')),
  actor       uuid,                                   -- compte qui a agi (pas d'e-mail ni d'IP)
  business_id uuid,                                   -- commerce concerné, sans clé étrangère : le journal survit à la suppression
  detail      text check (char_length(detail) <= 200) -- jamais de mot de passe ni de donnée personnelle
);
create index if not exists audit_log_idx on public.audit_log (type, created_at desc);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
drop policy if exists "admin lit le journal" on public.audit_log;
create policy "admin lit le journal" on public.audit_log
  for select to authenticated using (public.espace_is_admin());

-- Événements que l'utilisateur connecté peut signaler pour lui-même (30 max par heure).
create or replace function public.log_security_event(p_type text, p_detail text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if p_type not in ('login_success','access_denied','mfa_enrolled','mfa_removed','password_changed') then return; end if;
  if (select count(*) from public.audit_log where actor = auth.uid() and created_at > now() - interval '1 hour') >= 30 then return; end if;
  insert into public.audit_log (type, actor, detail) values (p_type, auth.uid(), left(p_detail, 200));
end $$;
revoke all on function public.log_security_event(text, text) from public;
grant execute on function public.log_security_event(text, text) to authenticated;

-- Échecs de connexion : appelable sans être connecté. On ne stocke qu'une empreinte
-- (SHA-256) de l'e-mail, pas l'e-mail. Plafond global pour qu'on ne puisse pas saturer le journal.
create or replace function public.log_login_failure(p_email_hash text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_email_hash is null or p_email_hash !~ '^[0-9a-f]{64}$' then return; end if;
  if (select count(*) from public.audit_log where type = 'login_failed' and created_at > now() - interval '1 hour') >= 500 then return; end if;
  insert into public.audit_log (type, detail) values ('login_failed', p_email_hash);
end $$;
revoke all on function public.log_login_failure(text) from public;
grant execute on function public.log_login_failure(text) to anon, authenticated;

-- Verrouillage temporaire : 5 échecs en 15 minutes pour la même adresse.
-- (Garde-fou de l'appli ; la vraie limite côté serveur est celle de Supabase Auth.)
create or replace function public.login_locked(p_email_hash text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_email_hash ~ '^[0-9a-f]{64}$' and (
    select count(*) from public.audit_log f
    where f.type = 'login_failed' and f.detail = p_email_hash and f.created_at > now() - interval '15 minutes'
      and f.created_at > coalesce((select max(s.created_at) from public.audit_log s where s.type = 'login_success' and s.detail = p_email_hash), '-infinity')
  ) >= 5;
$$;
revoke all on function public.login_locked(text) from public;
grant execute on function public.login_locked(text) to anon, authenticated;

-- ---------- 4. Contraintes de format (ne touchent que les NOUVELLES lignes) ----------
do $$ begin
  alter table public.espace_businesses add constraint espace_lien_http
    check (lien_avis_google is null or lien_avis_google ~* '^https?://') not valid;
exception when duplicate_object or undefined_table then null; end $$;
do $$ begin
  alter table public.crm_agence_projets add constraint crm_lien_http
    check (lien_site is null or lien_site ~* '^https?://') not valid;
exception when duplicate_object or undefined_table then null; end $$;
do $$ begin
  alter table public.user_resources add constraint resources_url_http
    check (url is null or url ~* '^https?://') not valid;
exception when duplicate_object or undefined_table then null; end $$;
do $$ begin
  alter table public.radar_leads add constraint leads_website_http
    check (website is null or website ~* '^https?://') not valid;
exception when duplicate_object or undefined_table or undefined_column then null; end $$;

-- ---------- 5. RGPD ----------
-- Export de toutes les données d'un client (droit d'accès / portabilité). Admin + 2FA seulement.
create or replace function public.espace_export_business(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.espace_is_admin() then raise exception 'Réservé à l''administrateur.'; end if;
  select jsonb_build_object(
    'exporte_le', now(),
    'commerce', (select to_jsonb(b) from public.espace_businesses b where b.id = p_business_id),
    'chiffres_mensuels', coalesce((select jsonb_agg(to_jsonb(s)) from public.espace_monthly_stats s where s.business_id = p_business_id), '[]'),
    'avis', coalesce((select jsonb_agg(to_jsonb(r)) from public.espace_reviews r where r.business_id = p_business_id), '[]'),
    'taches', coalesce((select jsonb_agg(to_jsonb(t)) from public.espace_tasks t where t.business_id = p_business_id), '[]'),
    'messages', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.espace_messages m where m.business_id = p_business_id), '[]')
  ) into result;
  insert into public.audit_log (type, actor, business_id) values ('data_exported', auth.uid(), p_business_id);
  return result;
end $$;
revoke all on function public.espace_export_business(uuid) from public;
grant execute on function public.espace_export_business(uuid) to authenticated;

-- Durées de conservation :
--   journal de sécurité : 12 mois (échecs de connexion : 30 jours) ;
--   messages d'un client : 24 mois ; le reste est supprimé avec le client (suppression en cascade).
create or replace function public.purge_old_data()
returns void language plpgsql security definer set search_path = public as $$
declare n_log int; n_msg int;
begin
  delete from public.audit_log where type = 'login_failed' and created_at < now() - interval '30 days';
  delete from public.audit_log where type <> 'purge' and created_at < now() - interval '12 months';
  get diagnostics n_log = row_count;
  delete from public.espace_messages where created_at < now() - interval '24 months';
  get diagnostics n_msg = row_count;
  insert into public.audit_log (type, detail) values ('purge', left(format('journal:%s messages:%s', n_log, n_msg), 200));
end $$;
revoke all on function public.purge_old_data() from public, anon, authenticated;

-- Planification quotidienne (3 h du matin). Si l'extension pg_cron n'est pas disponible,
-- le script continue : active-la dans Database > Extensions puis relance ce bloc.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule(jobid) from cron.job where jobname = 'zenoa-purge';
  perform cron.schedule('zenoa-purge', '0 3 * * *', 'select public.purge_old_data()');
exception when others then
  raise notice 'pg_cron indisponible (%). Purge à lancer à la main : select public.purge_old_data();', sqlerrm;
end $$;
