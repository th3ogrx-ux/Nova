-- ============================================================
-- NOVA — Chat (groupe + DM privé avec le chef)
-- À coller dans Supabase Dashboard > SQL Editor > Run
-- Ré-exécutable sans risque.
-- ============================================================

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id text not null,          -- 'group' OU l'id (uuid en texte) du setter concerné pour un DM avec le chef
  sender_id       uuid not null references public.profiles(id) on delete cascade,
  content         text not null,
  created_at      timestamptz not null default now(),
  read_at         timestamptz
);

create index if not exists messages_conversation_idx
  on public.messages (conversation_id, created_at);

alter table public.messages enable row level security;

-- Lecture : le groupe est ouvert à tous, un DM n'est lisible que par le setter
-- concerné et par le chef (qui voit tous les DM).
drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages
  for select using (
    conversation_id = 'group'
    or conversation_id = auth.uid()::text
    or public.is_chef()
  );

-- Écriture : idem — un setter ne peut écrire que dans le groupe ou dans SON
-- propre DM avec le chef, jamais dans le DM d'un autre setter.
drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and (
      conversation_id = 'group'
      or conversation_id = auth.uid()::text
      or public.is_chef()
    )
  );

-- Un utilisateur peut marquer comme lus les messages qu'il a reçus (pas les siens).
drop policy if exists "messages_update_read" on public.messages;
create policy "messages_update_read" on public.messages
  for update using (
    conversation_id = 'group'
    or conversation_id = auth.uid()::text
    or public.is_chef()
  );

alter publication supabase_realtime add table public.messages;
