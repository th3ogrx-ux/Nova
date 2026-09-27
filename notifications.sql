-- ============================================================
-- NOVA — Centre de notifications (cloche) : suivi de dernière lecture
-- À coller dans Supabase Dashboard > SQL Editor > Run
-- Ré-exécutable sans risque.
-- ============================================================

alter table public.profiles
  add column if not exists notifications_seen_at timestamptz not null default now();
