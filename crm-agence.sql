-- ============================================================
-- ZENOA RADAR — CRM Agence Web (page "CRM – Agence Web")
-- Deux tables : prospects & clients, et projets (sites des clients gagnés).
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

-- ---------- Prospects & clients ----------
create table if not exists public.crm_agence_prospects (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  entreprise         text not null check (char_length(entreprise) between 1 and 200),
  secteur            text check (secteur in ('Restaurant', 'Coiffeur/Beauté', 'Artisan', 'Commerce', 'Santé', 'Autre')),
  ville              text check (char_length(ville) <= 120),
  gerant             text check (char_length(gerant) <= 120),
  telephone          text check (char_length(telephone) <= 40),
  email              text check (char_length(email) <= 200),
  site_actuel        text check (site_actuel in ('Aucun', 'Vieux', 'Correct')),
  note_google        numeric(2, 1) check (note_google between 0 and 5),
  nb_avis            integer check (nb_avis >= 0),
  source             text check (source in ('Google Maps', 'Porte-à-porte', 'Téléphone', 'Email', 'Recommandation', 'Réseaux sociaux')),
  etape              text not null default 'À contacter'
                     check (etape in ('À contacter', 'Contacté', 'Intéressé', 'Rendez-vous', 'Maquette envoyée', 'Devis envoyé', 'Gagné', 'Perdu')),
  dernier_contact    date,
  prochaine_relance  date,
  prix_creation      numeric(10, 2) check (prix_creation >= 0),
  abonnement_mensuel numeric(10, 2) check (abonnement_mensuel >= 0),
  notes              text check (char_length(notes) <= 5000),
  gagne_le           date,  -- rempli par l'appli au passage en "Gagné" (compteur "gagnés ce mois-ci")
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists crm_agence_prospects_user_idx on public.crm_agence_prospects (user_id, created_at desc);

alter table public.crm_agence_prospects enable row level security;

drop policy if exists "user can manage own crm prospects" on public.crm_agence_prospects;
create policy "user can manage own crm prospects" on public.crm_agence_prospects
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.crm_agence_prospects to authenticated;

-- ---------- Projets (un site par client gagné) ----------
create table if not exists public.crm_agence_projets (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  prospect_id       uuid not null references public.crm_agence_prospects(id) on delete cascade,
  statut            text not null default 'Attente contenu'
                    check (statut in ('Attente contenu', 'En création', 'En validation', 'En ligne')),
  livraison_prevue  date,
  lien_site         text check (char_length(lien_site) <= 500),
  hebergeur_domaine text check (char_length(hebergeur_domaine) <= 200),
  acompte_paye      boolean not null default false,
  solde_paye        boolean not null default false,
  created_at        timestamptz not null default now()
);

create index if not exists crm_agence_projets_user_idx on public.crm_agence_projets (user_id, created_at desc);

alter table public.crm_agence_projets enable row level security;

-- Un projet ne peut être rattaché qu'à un de ses propres clients.
drop policy if exists "user can manage own crm projets" on public.crm_agence_projets;
create policy "user can manage own crm projets" on public.crm_agence_projets
  for all to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.crm_agence_prospects p where p.id = prospect_id and p.user_id = auth.uid())
  );

grant select, insert, update, delete on public.crm_agence_projets to authenticated;

notify pgrst, 'reload schema';
