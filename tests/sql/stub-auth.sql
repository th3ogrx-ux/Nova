-- Imite le strict nécessaire de Supabase pour tester les politiques RLS en local.
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$; do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('sub', current_setting('request.jwt.claim.sub', true), 'aal', nullif(current_setting('request.jwt.claim.aal', true), '')) $$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
-- tables "anciennes" (modèle auth.uid() = user_id) représentatives
create table public.crm_agence_prospects (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), entreprise text);
create table public.crm_agence_projets (id uuid primary key default gen_random_uuid(), user_id uuid not null, lien_site text);
create table public.user_resources (id uuid primary key default gen_random_uuid(), user_id uuid not null, url text);
create table public.radar_leads (id uuid primary key default gen_random_uuid(), user_id uuid not null, website text);
do $$ declare t text; begin
  foreach t in array array['crm_agence_prospects','crm_agence_projets','user_resources','radar_leads'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy own on public.%I for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
