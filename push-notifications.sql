-- ============================================================
-- ZENOA — Notifications push web (BoxMail)
-- À coller dans Supabase Dashboard > SQL Editor > Run
-- Ré-exécutable sans risque.
-- ============================================================

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Un membre ne gère que ses propres abonnements (son navigateur).
drop policy if exists "push_subscriptions_select" on public.push_subscriptions;
create policy "push_subscriptions_select" on public.push_subscriptions
  for select using (user_id = auth.uid());

drop policy if exists "push_subscriptions_insert" on public.push_subscriptions;
create policy "push_subscriptions_insert" on public.push_subscriptions
  for insert with check (user_id = auth.uid());

drop policy if exists "push_subscriptions_delete" on public.push_subscriptions;
create policy "push_subscriptions_delete" on public.push_subscriptions
  for delete using (user_id = auth.uid());

grant select, insert, delete on public.push_subscriptions to authenticated;

-- La fonction Edge (clé service_role) doit pouvoir tout lire pour envoyer
-- les push et nettoyer les abonnements expirés : elle contourne la RLS
-- automatiquement via la clé service_role, aucune policy supplémentaire
-- n'est nécessaire pour elle.
