-- ============================================================
-- NOVA — BoxMail (mails privés entre membres, façon boîte mail)
-- À coller dans Supabase Dashboard > SQL Editor > Run
-- Ré-exécutable sans risque.
-- ============================================================

create table if not exists public.boxmails (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  content      text not null,
  created_at   timestamptz not null default now(),
  read_at      timestamptz,
  validated_at timestamptz
);

create index if not exists boxmails_recipient_idx
  on public.boxmails (recipient_id, validated_at, created_at);

alter table public.boxmails enable row level security;

-- Lecture : seulement l'expéditeur et le destinataire du mail.
drop policy if exists "boxmails_select" on public.boxmails;
create policy "boxmails_select" on public.boxmails
  for select using (
    sender_id = auth.uid() or recipient_id = auth.uid()
  );

-- Écriture : on ne peut envoyer un mail qu'en son propre nom.
drop policy if exists "boxmails_insert" on public.boxmails;
create policy "boxmails_insert" on public.boxmails
  for insert with check (
    sender_id = auth.uid()
  );

-- Mise à jour : seul le destinataire peut marquer comme lu / valider.
drop policy if exists "boxmails_update" on public.boxmails;
create policy "boxmails_update" on public.boxmails
  for update using (
    recipient_id = auth.uid()
  ) with check (
    recipient_id = auth.uid()
  );

grant select, insert, update on public.boxmails to authenticated;

alter publication supabase_realtime add table public.boxmails;
