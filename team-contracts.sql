-- ============================================================
-- ZENOA — Contrats équipe (Administratif > Contrats équipe)
-- À coller dans Supabase Dashboard > SQL Editor > Run
-- Ré-exécutable sans risque.
-- ============================================================

create table if not exists public.team_contracts (
  id               uuid primary key default gen_random_uuid(),
  created_by       uuid references public.profiles(id) on delete set null,
  setter_id        uuid references public.profiles(id) on delete set null,
  pseudo           text,
  position         text,
  percentage       numeric,
  duration         text,
  start_date       date,
  trial_period     text,
  notice_period    text,
  confidentiality  boolean not null default false,
  notes            text,
  content          text not null,
  status           text not null default 'draft', -- draft | sent | signed | returned
  signature_name   text,
  signed_at        timestamptz,
  returned_at      timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists team_contracts_setter_idx
  on public.team_contracts (setter_id, created_at);

alter table public.boxmails add column if not exists contract_id uuid references public.team_contracts(id) on delete set null;

alter table public.team_contracts enable row level security;

-- Lecture : le chef qui a créé le contrat, ou le setter concerné.
drop policy if exists "team_contracts_select" on public.team_contracts;
create policy "team_contracts_select" on public.team_contracts
  for select using (
    created_by = auth.uid() or setter_id = auth.uid()
  );

-- Création : seulement en son propre nom (le chef qui génère).
drop policy if exists "team_contracts_insert" on public.team_contracts;
create policy "team_contracts_insert" on public.team_contracts
  for insert with check (
    created_by = auth.uid()
  );

-- Mise à jour : le chef (envoi, suppression logique) ou le setter (signature, renvoi).
drop policy if exists "team_contracts_update" on public.team_contracts;
create policy "team_contracts_update" on public.team_contracts
  for update using (
    created_by = auth.uid() or setter_id = auth.uid()
  ) with check (
    created_by = auth.uid() or setter_id = auth.uid()
  );

-- Suppression : seulement le chef qui l'a créé.
drop policy if exists "team_contracts_delete" on public.team_contracts;
create policy "team_contracts_delete" on public.team_contracts
  for delete using (
    created_by = auth.uid()
  );

grant select, insert, update, delete on public.team_contracts to authenticated;

alter publication supabase_realtime add table public.team_contracts;
