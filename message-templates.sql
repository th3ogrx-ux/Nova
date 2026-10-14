-- ============================================================
-- ZENOA RADAR — Étape 4 : modèles de message de premier contact.
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque.
-- ============================================================

create table if not exists public.message_templates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  subject    text not null default '',
  body       text not null default '',
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists message_templates_user_id_idx on public.message_templates (user_id);

alter table public.message_templates enable row level security;

drop policy if exists "user can manage own templates" on public.message_templates;
create policy "user can manage own templates" on public.message_templates
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.message_templates to authenticated;

-- Crée un modèle par défaut à l'inscription : propose une maquette
-- gratuite et sans engagement, avec une phrase pour ne plus être
-- recontacté (consentement respecté dès le premier message).
create or replace function public.handle_new_user_template()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.message_templates (user_id, name, subject, body, is_default)
  values (
    new.id,
    'Proposition de maquette gratuite',
    'Un site pour {nom} ?',
    E'Bonjour,\n\nJe suis tombé sur la fiche de {nom} à {ville} et j''ai remarqué qu''il n''y a pas encore de site internet (ou qu''il pourrait être modernisé).\n\nJe vous propose de créer gratuitement et sans engagement une maquette de site vitrine pour {nom}, que vous pourrez consulter avant de décider si ça vous intéresse.\n\nSi ça vous tente, répondez simplement à ce message et je vous l''envoie.\n\nSi vous préférez ne plus être contacté, dites-le moi et je ne vous recontacterai pas.\n\nBonne journée !',
    true
  )
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_template on auth.users;
create trigger on_auth_user_created_template
  after insert on auth.users
  for each row execute function public.handle_new_user_template();

notify pgrst, 'reload schema';
