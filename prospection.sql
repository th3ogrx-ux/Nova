-- ZENOA AGENCY — module « Prospection » (stratégies, pipeline, scripts, offres, revue de la semaine)
-- À coller dans Supabase > SQL Editor > Run. Peut être relancé sans risque.
-- À lancer APRÈS espace.sql et securite.sql (il réutilise la règle « admin seulement »).

-- ---------- Tables ----------
create table if not exists public.pro_strategies (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  titre      text not null check (char_length(titre) between 1 and 120),
  canal      text not null default 'autre' check (canal in ('instagram','email','telephone','linkedin','terrain','google_maps','autre')),
  cible      text check (char_length(cible) <= 200),
  statut     text not null default 'a_tester' check (statut in ('a_tester','en_cours','validee','abandonnee')),
  notes      text check (char_length(notes) <= 4000),          -- apprentissages
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.pro_scripts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  strategy_id uuid not null references public.pro_strategies(id) on delete cascade,
  version     text not null default 'A' check (version in ('A','B','C','D')),
  texte       text not null check (char_length(texte) between 1 and 4000),
  created_at  timestamptz not null default now(),
  unique (strategy_id, version)
);

-- Une ligne = une saisie d'activité (messages du jour pour une stratégie / version de script).
create table if not exists public.pro_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  jour        date not null default current_date,
  strategy_id uuid references public.pro_strategies(id) on delete set null,
  script_id   uuid references public.pro_scripts(id) on delete set null,
  envoyes     integer not null default 0 check (envoyes between 0 and 100000),
  reponses    integer not null default 0 check (reponses between 0 and 100000),
  interesses  integer not null default 0 check (interesses between 0 and 100000),
  audits      integer not null default 0 check (audits between 0 and 100000),
  clients     integer not null default 0 check (clients between 0 and 100000),
  note        text check (char_length(note) <= 300),
  created_at  timestamptz not null default now()
);

create table if not exists public.pro_prospects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nom         text not null check (char_length(nom) between 1 and 120),
  contact     text check (char_length(contact) <= 200),
  canal       text check (canal in ('instagram','email','telephone','linkedin','terrain','google_maps','autre')),
  strategy_id uuid references public.pro_strategies(id) on delete set null,
  etape       text not null default 'contacte' check (etape in ('contacte','repondu','interesse','audit','signe')),
  valeur      numeric(10,2) check (valeur >= 0),
  notes       text check (char_length(notes) <= 2000),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.pro_offers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nom         text not null check (char_length(nom) between 1 and 60),
  prix        numeric(10,2) not null check (prix >= 0),
  periode     text not null default 'unique' check (periode in ('unique','mois')),
  description text check (char_length(description) <= 200),
  atouts      text check (char_length(atouts) <= 1000),        -- un atout par ligne
  populaire   boolean not null default false,
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Offres à long terme : liste d'étapes [{titre, mois, prix, mode: 'mois'|'total', detail}], ex. 3 mois à 180 € puis 3 mois de réseaux sociaux.
alter table public.pro_offers add column if not exists phases jsonb not null default '[]'::jsonb;
do $$ begin
  alter table public.pro_offers add constraint pro_offers_phases_ok
    check (jsonb_typeof(phases) = 'array' and jsonb_array_length(phases) <= 12 and char_length(phases::text) <= 6000);
exception when duplicate_object then null; end $$;

create table if not exists public.pro_reviews (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  semaine   date not null,                                      -- le lundi de la semaine
  q_bien    text check (char_length(q_bien) <= 2000),
  q_mieux   text check (char_length(q_mieux) <= 2000),
  q_suite   text check (char_length(q_suite) <= 2000),
  lecons    text check (char_length(lecons) <= 4000),
  updated_at timestamptz not null default now(),
  unique (user_id, semaine)
);

create table if not exists public.pro_settings (
  user_id        uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  objectif_hebdo integer not null default 50 check (objectif_hebdo between 1 and 10000)
);

create index if not exists pro_logs_idx      on public.pro_logs (user_id, jour desc);
create index if not exists pro_scripts_idx   on public.pro_scripts (strategy_id);
create index if not exists pro_prospects_idx on public.pro_prospects (user_id, etape, position);

-- ---------- Sécurité : chaque ligne appartient à son compte, et seul l'admin y accède ----------
do $$
declare t text;
begin
  foreach t in array array['pro_strategies','pro_scripts','pro_logs','pro_prospects','pro_offers','pro_reviews','pro_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "mes lignes" on public.%I', t);
    execute format('create policy "mes lignes" on public.%I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    -- règle « admin seulement » (fonction créée par securite.sql)
    if to_regprocedure('public.espace_admin_ok()') is not null then
      execute format('drop policy if exists "acces sur invitation" on public.%I', t);
      execute format('create policy "acces sur invitation" on public.%I as restrictive for all to authenticated using (public.espace_admin_ok()) with check (public.espace_admin_ok())', t);
    else
      raise notice 'securite.sql n''est pas installé : lance-le puis relance ce fichier.';
    end if;
  end loop;
end $$;

-- Une stratégie ou un prospect ne peut référencer que ses propres lignes.
create or replace function public.pro_same_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'pro_scripts' and not exists (select 1 from public.pro_strategies where id = new.strategy_id and user_id = new.user_id) then
    raise exception 'Stratégie inconnue.';
  end if;
  if tg_table_name in ('pro_logs','pro_prospects') then
    if new.strategy_id is not null and not exists (select 1 from public.pro_strategies where id = new.strategy_id and user_id = new.user_id) then
      raise exception 'Stratégie inconnue.';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.pro_same_owner() from public, anon, authenticated;
drop trigger if exists pro_scripts_owner on public.pro_scripts;
create trigger pro_scripts_owner before insert or update on public.pro_scripts for each row execute function public.pro_same_owner();
drop trigger if exists pro_logs_owner on public.pro_logs;
create trigger pro_logs_owner before insert or update on public.pro_logs for each row execute function public.pro_same_owner();
drop trigger if exists pro_prospects_owner on public.pro_prospects;
create trigger pro_prospects_owner before insert or update on public.pro_prospects for each row execute function public.pro_same_owner();

notify pgrst, 'reload schema';
