-- ============================================================
-- ZENOA — Réponses du formulaire "Partenariat" (landing page)
-- À coller dans Supabase Dashboard > SQL Editor > Run
-- Ré-exécutable sans risque.
-- ============================================================

create table if not exists public.partnership_leads (
  id         uuid primary key default gen_random_uuid(),
  activite   text,
  taille     text,
  blocage    text,
  delai      text,
  budget     text,
  email      text,
  telephone  text,
  created_at timestamptz not null default now()
);

create index if not exists partnership_leads_created_idx
  on public.partnership_leads (created_at desc);

alter table public.partnership_leads enable row level security;

-- Le formulaire public de la landing page (clé publique, pas de session)
-- peut uniquement insérer une nouvelle réponse.
drop policy if exists "partnership_leads_insert_public" on public.partnership_leads;
create policy "partnership_leads_insert_public" on public.partnership_leads
  for insert to anon with check (true);

-- Seul le chef connecté peut lire / supprimer les réponses.
drop policy if exists "partnership_leads_select_chef" on public.partnership_leads;
create policy "partnership_leads_select_chef" on public.partnership_leads
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'chef')
  );

drop policy if exists "partnership_leads_delete_chef" on public.partnership_leads;
create policy "partnership_leads_delete_chef" on public.partnership_leads
  for delete using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'chef')
  );

grant insert on public.partnership_leads to anon;
grant select, delete on public.partnership_leads to authenticated;

alter publication supabase_realtime add table public.partnership_leads;
