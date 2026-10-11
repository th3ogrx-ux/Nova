-- ============================================================
-- NOVA / ZENOA — Résultats (€ réalisés) par élève.
-- Accès entièrement réservé au chef : les élèves ne voient ni ne
-- renseignent rien ici, c'est le chef qui entre chaque paiement
-- depuis la fiche élève (Élèves > un élève > badge €).
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

create table if not exists public.student_payments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  amount      numeric not null,
  paid_at     date not null default current_date,
  created_at  timestamptz not null default now()
);

create index if not exists student_payments_user_id_idx
  on public.student_payments (user_id);

alter table public.student_payments enable row level security;

drop policy if exists "admin can manage payments" on public.student_payments;
create policy "admin can manage payments" on public.student_payments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update, delete on public.student_payments to authenticated;

notify pgrst, 'reload schema';
