-- ============================================================
-- NOVA — Chat v2 : accusés de lecture + dernière activité
-- À coller dans Supabase Dashboard > SQL Editor > Run
-- (à exécuter APRÈS chat.sql, ré-exécutable sans risque)
-- ============================================================

-- Dernière activité (mise à jour à chaque chargement de page connecté)
alter table public.profiles add column if not exists last_seen_at timestamptz;

-- Qui a lu quel message (utilisé pour le groupe, où plusieurs personnes lisent)
create table if not exists public.message_reads (
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  read_at    timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.message_reads enable row level security;

drop policy if exists "message_reads_select" on public.message_reads;
create policy "message_reads_select" on public.message_reads
  for select using (
    exists (
      select 1 from public.messages m
      where m.id = message_id
        and (m.conversation_id = 'group' or m.conversation_id = auth.uid()::text or public.is_chef())
    )
  );

drop policy if exists "message_reads_insert" on public.message_reads;
create policy "message_reads_insert" on public.message_reads
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_id
        and (m.conversation_id = 'group' or m.conversation_id = auth.uid()::text or public.is_chef())
    )
  );

alter publication supabase_realtime add table public.message_reads;
