-- ============================================================
-- ZENOA ESPACE — structure de la base + sécurité (RLS)
-- À coller dans Supabase > SQL Editor > Run. Ré-exécutable sans risque.
--
-- Principe de sécurité : TOUTES les règles sont ici, dans la base.
-- Même si quelqu'un modifie les requêtes de son navigateur, la base
-- refuse ce que son rôle n'a pas le droit de lire ou d'écrire.
--   - admin  : voit et modifie tout
--   - client : lit uniquement SON commerce ; ne peut écrire que des
--              messages (et marquer les réponses reçues comme lues)
-- ============================================================

-- ---------- Types ----------
do $$ begin
  create type public.user_role as enum ('admin', 'client');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.task_status as enum ('fait', 'en_cours', 'a_venir');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.message_author as enum ('admin', 'client');
exception when duplicate_object then null; end $$;

-- ---------- Tables ----------
create table if not exists public.businesses (
  id               uuid primary key default gen_random_uuid(),
  nom              text not null check (char_length(nom) between 1 and 150),
  secteur          text check (char_length(secteur) <= 80),
  ville            text check (char_length(ville) <= 80),
  lien_avis_google text check (char_length(lien_avis_google) <= 500),
  couleur_accent   text check (couleur_accent ~ '^#[0-9A-Fa-f]{6}$'),
  is_example       boolean not null default false,  -- données de démonstration (seed)
  created_at       timestamptz not null default now()
);

-- Un profil par compte de connexion (Supabase Auth). Pas de profil = aucun accès.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        public.user_role not null,
  business_id uuid references public.businesses(id) on delete cascade,
  created_at  timestamptz not null default now(),
  -- un client a toujours un commerce, l'admin n'en a jamais
  constraint profiles_role_business check (
    (role = 'admin' and business_id is null) or (role = 'client' and business_id is not null)
  )
);

create table if not exists public.monthly_stats (
  business_id   uuid not null references public.businesses(id) on delete cascade,
  mois          date not null check (mois = date_trunc('month', mois)::date), -- 1er jour du mois
  appels        integer not null default 0 check (appels >= 0),
  itineraires   integer not null default 0 check (itineraires >= 0),
  vues_fiche    integer not null default 0 check (vues_fiche >= 0),
  visites_site  integer not null default 0 check (visites_site >= 0),
  updated_at    timestamptz not null default now(),
  primary key (business_id, mois)
);

-- Avis : uniquement le nécessaire (prénom/pseudo, note, texte, date).
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  auteur      text not null check (char_length(auteur) between 1 and 80),
  note        smallint not null check (note between 1 and 5),
  texte       text check (char_length(texte) <= 2000),
  date        date not null default current_date,
  repondu     boolean not null default false,
  reponse     text check (char_length(reponse) <= 2000)
);

create table if not exists public.tasks (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  titre       text not null check (char_length(titre) between 1 and 200),
  statut      public.task_status not null default 'a_venir',
  mois        date not null check (mois = date_trunc('month', mois)::date)
);

create table if not exists public.messages (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  auteur      public.message_author not null,
  texte       text not null check (char_length(texte) between 1 and 4000),
  created_at  timestamptz not null default now(),
  lu          boolean not null default false
);

create index if not exists reviews_business_date_idx on public.reviews (business_id, date desc);
create index if not exists tasks_business_mois_idx   on public.tasks (business_id, mois);
create index if not exists messages_business_idx     on public.messages (business_id, created_at);
create index if not exists profiles_business_idx     on public.profiles (business_id);

-- ---------- Fonctions d'aide pour les règles ----------
-- "security definer" : elles lisent profiles sans être bloquées par ses propres
-- règles (sinon la règle de profiles se lirait elle-même en boucle).
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.my_business_id()
returns uuid language sql stable security definer set search_path = public as $$
  select business_id from public.profiles where id = auth.uid() and role = 'client';
$$;

revoke all on function public.is_admin() from public;
revoke all on function public.my_business_id() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.my_business_id() to authenticated;

-- ---------- Activation de la sécurité sur CHAQUE table ----------
alter table public.businesses    enable row level security;
alter table public.profiles      enable row level security;
alter table public.monthly_stats enable row level security;
alter table public.reviews       enable row level security;
alter table public.tasks         enable row level security;
alter table public.messages      enable row level security;

-- On retire d'abord tout droit par défaut, puis on accorde le strict nécessaire.
revoke all on public.businesses, public.profiles, public.monthly_stats,
              public.reviews, public.tasks, public.messages from anon, authenticated;

-- ---------- businesses ----------
grant select, insert, update, delete on public.businesses to authenticated;
drop policy if exists "admin gère les commerces" on public.businesses;
create policy "admin gère les commerces" on public.businesses
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "client lit son commerce" on public.businesses;
create policy "client lit son commerce" on public.businesses
  for select to authenticated using (id = public.my_business_id());

-- ---------- profiles ----------
-- Lecture seule pour l'utilisateur (son propre profil). Les profils sont créés
-- uniquement par l'admin, côté serveur, avec la clé secrète.
grant select on public.profiles to authenticated;
drop policy if exists "lire son profil" on public.profiles;
create policy "lire son profil" on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

-- ---------- monthly_stats ----------
grant select, insert, update, delete on public.monthly_stats to authenticated;
drop policy if exists "admin gère les chiffres" on public.monthly_stats;
create policy "admin gère les chiffres" on public.monthly_stats
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "client lit ses chiffres" on public.monthly_stats;
create policy "client lit ses chiffres" on public.monthly_stats
  for select to authenticated using (business_id = public.my_business_id());

-- ---------- reviews ----------
grant select, insert, update, delete on public.reviews to authenticated;
drop policy if exists "admin gère les avis" on public.reviews;
create policy "admin gère les avis" on public.reviews
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "client lit ses avis" on public.reviews;
create policy "client lit ses avis" on public.reviews
  for select to authenticated using (business_id = public.my_business_id());

-- ---------- tasks ----------
grant select, insert, update, delete on public.tasks to authenticated;
drop policy if exists "admin gère les tâches" on public.tasks;
create policy "admin gère les tâches" on public.tasks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "client lit ses tâches" on public.tasks;
create policy "client lit ses tâches" on public.tasks
  for select to authenticated using (business_id = public.my_business_id());

-- ---------- messages ----------
-- Le client lit sa conversation et peut y ÉCRIRE (uniquement en son nom, dans
-- son commerce). Il ne peut ni modifier ni supprimer un message : pour marquer
-- les réponses comme lues, il passe par mark_messages_read() ci-dessous.
grant select, insert, update, delete on public.messages to authenticated;
drop policy if exists "admin gère les messages" on public.messages;
create policy "admin gère les messages" on public.messages
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists "client lit sa conversation" on public.messages;
create policy "client lit sa conversation" on public.messages
  for select to authenticated using (business_id = public.my_business_id());
drop policy if exists "client écrit dans sa conversation" on public.messages;
create policy "client écrit dans sa conversation" on public.messages
  for insert to authenticated
  with check (business_id = public.my_business_id() and auteur = 'client' and lu = false);

-- Marque comme lus les messages de l'AUTRE partie dans la conversation du
-- compte connecté (le client lit les réponses de l'admin ; l'admin, ceux du
-- client du commerce donné).
create or replace function public.mark_messages_read(p_business_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then
    update public.messages set lu = true
      where business_id = p_business_id and auteur = 'client' and lu = false;
  elsif public.my_business_id() is not null then
    update public.messages set lu = true
      where business_id = public.my_business_id() and auteur = 'admin' and lu = false;
  end if;
end $$;

revoke all on function public.mark_messages_read(uuid) from public;
grant execute on function public.mark_messages_read(uuid) to authenticated;

-- Le client ne peut pas modifier la table directement (la règle "admin gère" ne
-- le laisse pas), donc aucune autre écriture client n'est possible.

notify pgrst, 'reload schema';
