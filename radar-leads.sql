-- ZENOA — table des prospects générés automatiquement par Zenoa Radar
-- (tirage quotidien de 20 fiches, jamais deux fois la même entreprise)

create table if not exists public.radar_leads (
  id uuid primary key default gen_random_uuid(),
  place_id text unique not null,
  name text not null,
  address text,
  phone text,
  website text,
  email text,
  category_label text,
  city text,
  sent_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists radar_leads_sent_date_idx on public.radar_leads (sent_date);

alter table public.radar_leads enable row level security;

-- toute l'équipe connectée peut voir les prospects (lecture seule) ;
-- seule la fonction planifiée (clé service_role, qui contourne RLS) écrit dedans.
create policy "team can read radar leads"
  on public.radar_leads for select
  to authenticated
  using (true);
