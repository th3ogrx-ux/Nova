-- ============================================================
-- ZENOA RADAR — Étape 1 : comptes utilisateurs, plans et quotas.
-- Réutilise le même projet Supabase que l'ancien site (mêmes
-- URL/clé publique), mais sur des tables toutes neuves, indépendantes
-- des anciennes tables (profiles, access_codes, etc. — orphelines,
-- pas touchées).
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

-- ---------- Catalogue des plans (gratuit / pro) ----------
create table if not exists public.plans (
  id                      text primary key,
  label                   text not null,
  max_searches_per_month  integer not null,
  max_prospects           integer not null,
  max_demo_sites          integer not null
);

insert into public.plans (id, label, max_searches_per_month, max_prospects, max_demo_sites)
values
  ('free', 'Gratuit', 20, 100, 10),
  ('pro',  'Pro',     200, 2000, 200)
on conflict (id) do update set
  label = excluded.label,
  max_searches_per_month = excluded.max_searches_per_month,
  max_prospects = excluded.max_prospects,
  max_demo_sites = excluded.max_demo_sites;

-- ---------- Plan de chaque utilisateur ----------
create table if not exists public.user_plans (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  plan_id    text not null references public.plans(id) default 'free',
  created_at timestamptz not null default now()
);

alter table public.plans enable row level security;
alter table public.user_plans enable row level security;

drop policy if exists "plans readable by authenticated" on public.plans;
create policy "plans readable by authenticated" on public.plans
  for select to authenticated using (true);

drop policy if exists "user can read own plan" on public.user_plans;
create policy "user can read own plan" on public.user_plans
  for select to authenticated using (auth.uid() = user_id);

grant select on public.plans to authenticated;
grant select on public.user_plans to authenticated;

-- Crée automatiquement une ligne "plan gratuit" à chaque inscription.
create or replace function public.handle_new_user_plan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_plans (user_id, plan_id) values (new.id, 'free')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_plan on auth.users;
create trigger on_auth_user_created_plan
  after insert on auth.users
  for each row execute function public.handle_new_user_plan();

notify pgrst, 'reload schema';
