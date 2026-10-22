-- ============================================================
-- ZENOA — Espace clients (suivi de visibilité Google)
-- Étape 1 : tables + règles de sécurité (RLS) + désignation de l'admin.
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque. Ne touche à AUCUNE table existante :
-- toutes les nouvelles tables commencent par "espace_".
--
-- Sécurité : tout est décidé ici, dans la base. Même si quelqu'un
-- modifie les requêtes de son navigateur, la base refuse.
--   admin  : voit et modifie tout l'espace clients
--   client : lit UNIQUEMENT son commerce ; écrit uniquement des messages
--   autre  : (utilisateur Radar sans profil) n'a aucun accès ici
-- ============================================================

-- ---------- Types ----------
do $$ begin create type public.espace_role as enum ('admin', 'client');
exception when duplicate_object then null; end $$;
do $$ begin create type public.espace_task_status as enum ('fait', 'en_cours', 'a_venir');
exception when duplicate_object then null; end $$;
do $$ begin create type public.espace_author as enum ('admin', 'client');
exception when duplicate_object then null; end $$;

-- ---------- Tables ----------
create table if not exists public.espace_businesses (
  id               uuid primary key default gen_random_uuid(),
  nom              text not null check (char_length(nom) between 1 and 150),
  secteur          text check (char_length(secteur) <= 80),
  ville            text check (char_length(ville) <= 80),
  lien_avis_google text check (char_length(lien_avis_google) <= 500),
  couleur_accent   text check (couleur_accent ~ '^#[0-9A-Fa-f]{6}$'),
  is_example       boolean not null default false,   -- données de démonstration
  created_at       timestamptz not null default now()
);

-- Un profil par compte "espace". Pas de profil = aucun accès à l'espace clients.
create table if not exists public.espace_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        public.espace_role not null,
  business_id uuid references public.espace_businesses(id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint espace_profiles_role_business check (
    (role = 'admin' and business_id is null) or (role = 'client' and business_id is not null)
  )
);

create table if not exists public.espace_monthly_stats (
  business_id  uuid not null references public.espace_businesses(id) on delete cascade,
  mois         date not null check (mois = date_trunc('month', mois)::date),  -- 1er jour du mois
  appels       integer not null default 0 check (appels >= 0),
  itineraires  integer not null default 0 check (itineraires >= 0),
  vues_fiche   integer not null default 0 check (vues_fiche >= 0),
  visites_site integer not null default 0 check (visites_site >= 0),
  updated_at   timestamptz not null default now(),
  primary key (business_id, mois)
);

-- Avis : uniquement le nécessaire (prénom/pseudo, note, texte, date).
create table if not exists public.espace_reviews (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.espace_businesses(id) on delete cascade,
  auteur      text not null check (char_length(auteur) between 1 and 80),
  note        smallint not null check (note between 1 and 5),
  texte       text check (char_length(texte) <= 2000),
  date        date not null default current_date,
  repondu     boolean not null default false,
  reponse     text check (char_length(reponse) <= 2000)
);

create table if not exists public.espace_tasks (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.espace_businesses(id) on delete cascade,
  titre       text not null check (char_length(titre) between 1 and 200),
  statut      public.espace_task_status not null default 'a_venir',
  mois        date not null check (mois = date_trunc('month', mois)::date)
);

create table if not exists public.espace_messages (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.espace_businesses(id) on delete cascade,
  auteur      public.espace_author not null,
  texte       text not null check (char_length(texte) between 1 and 4000),
  created_at  timestamptz not null default now(),
  lu          boolean not null default false
);

create index if not exists espace_reviews_idx  on public.espace_reviews (business_id, date desc);
create index if not exists espace_tasks_idx    on public.espace_tasks (business_id, mois);
create index if not exists espace_messages_idx on public.espace_messages (business_id, created_at);
create index if not exists espace_profiles_idx on public.espace_profiles (business_id);

-- ---------- Fonctions d'aide pour les règles ----------
-- "security definer" : elles lisent espace_profiles sans être bloquées par
-- ses propres règles (sinon la règle se lirait elle-même en boucle).
create or replace function public.espace_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.espace_profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.espace_my_business()
returns uuid language sql stable security definer set search_path = public as $$
  select business_id from public.espace_profiles where id = auth.uid() and role = 'client';
$$;

revoke all on function public.espace_is_admin() from public;
revoke all on function public.espace_my_business() from public;
grant execute on function public.espace_is_admin() to authenticated;
grant execute on function public.espace_my_business() to authenticated;

-- ---------- Sécurité activée sur CHAQUE table ----------
alter table public.espace_businesses    enable row level security;
alter table public.espace_profiles      enable row level security;
alter table public.espace_monthly_stats enable row level security;
alter table public.espace_reviews       enable row level security;
alter table public.espace_tasks         enable row level security;
alter table public.espace_messages      enable row level security;

revoke all on public.espace_businesses, public.espace_profiles, public.espace_monthly_stats,
              public.espace_reviews, public.espace_tasks, public.espace_messages from anon, authenticated;

-- espace_businesses
grant select, insert, update, delete on public.espace_businesses to authenticated;
drop policy if exists "admin gère les commerces" on public.espace_businesses;
create policy "admin gère les commerces" on public.espace_businesses
  for all to authenticated using (public.espace_is_admin()) with check (public.espace_is_admin());
drop policy if exists "client lit son commerce" on public.espace_businesses;
create policy "client lit son commerce" on public.espace_businesses
  for select to authenticated using (id = public.espace_my_business());

-- espace_profiles : lecture seule de son propre profil. Les profils sont créés
-- uniquement côté serveur (clé secrète), jamais depuis le navigateur.
grant select on public.espace_profiles to authenticated;
drop policy if exists "lire son profil espace" on public.espace_profiles;
create policy "lire son profil espace" on public.espace_profiles
  for select to authenticated using (id = auth.uid() or public.espace_is_admin());

-- espace_monthly_stats
grant select, insert, update, delete on public.espace_monthly_stats to authenticated;
drop policy if exists "admin gère les chiffres" on public.espace_monthly_stats;
create policy "admin gère les chiffres" on public.espace_monthly_stats
  for all to authenticated using (public.espace_is_admin()) with check (public.espace_is_admin());
drop policy if exists "client lit ses chiffres" on public.espace_monthly_stats;
create policy "client lit ses chiffres" on public.espace_monthly_stats
  for select to authenticated using (business_id = public.espace_my_business());

-- espace_reviews
grant select, insert, update, delete on public.espace_reviews to authenticated;
drop policy if exists "admin gère les avis" on public.espace_reviews;
create policy "admin gère les avis" on public.espace_reviews
  for all to authenticated using (public.espace_is_admin()) with check (public.espace_is_admin());
drop policy if exists "client lit ses avis" on public.espace_reviews;
create policy "client lit ses avis" on public.espace_reviews
  for select to authenticated using (business_id = public.espace_my_business());

-- espace_tasks
grant select, insert, update, delete on public.espace_tasks to authenticated;
drop policy if exists "admin gère les tâches" on public.espace_tasks;
create policy "admin gère les tâches" on public.espace_tasks
  for all to authenticated using (public.espace_is_admin()) with check (public.espace_is_admin());
drop policy if exists "client lit ses tâches" on public.espace_tasks;
create policy "client lit ses tâches" on public.espace_tasks
  for select to authenticated using (business_id = public.espace_my_business());

-- espace_messages : le client lit sa conversation et y ÉCRIT (en son nom
-- uniquement). Il ne peut ni modifier ni supprimer : pour marquer les réponses
-- comme lues, il passe par espace_mark_read().
grant select, insert, update, delete on public.espace_messages to authenticated;
drop policy if exists "admin gère les messages" on public.espace_messages;
create policy "admin gère les messages" on public.espace_messages
  for all to authenticated using (public.espace_is_admin()) with check (public.espace_is_admin());
drop policy if exists "client lit sa conversation" on public.espace_messages;
create policy "client lit sa conversation" on public.espace_messages
  for select to authenticated using (business_id = public.espace_my_business());
drop policy if exists "client écrit dans sa conversation" on public.espace_messages;
create policy "client écrit dans sa conversation" on public.espace_messages
  for insert to authenticated
  with check (business_id = public.espace_my_business() and auteur = 'client' and lu = false);

create or replace function public.espace_mark_read(p_business_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.espace_is_admin() then
    update public.espace_messages set lu = true
      where business_id = p_business_id and auteur = 'client' and lu = false;
  elsif public.espace_my_business() is not null then
    update public.espace_messages set lu = true
      where business_id = public.espace_my_business() and auteur = 'admin' and lu = false;
  end if;
end $$;
revoke all on function public.espace_mark_read(uuid) from public;
grant execute on function public.espace_mark_read(uuid) to authenticated;

-- ---------- Désignation de l'admin (voir en haut) ----------
do $$
declare
  v_email text := 'TON_EMAIL@exemple.fr';   -- <-- l'email de ton compte Radar
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(v_email);
  if v_id is null then
    raise exception 'Aucun compte avec l''email % : remplace TON_EMAIL@exemple.fr par l''email de ton compte Radar.', v_email;
  end if;
  insert into public.espace_profiles (id, role, business_id) values (v_id, 'admin', null)
  on conflict (id) do update set role = 'admin', business_id = null;
end $$;

notify pgrst, 'reload schema';

-- ============================================================
-- FACULTATIF — messages en direct (sans attendre l'actualisation de 30 s)
-- À coller séparément dans le SQL Editor si tu le souhaites. Sans lui, la
-- messagerie fonctionne quand même : elle se met à jour toutes les 30 s et
-- à chaque retour sur l'onglet.
-- ============================================================
-- alter publication supabase_realtime add table public.espace_messages;
