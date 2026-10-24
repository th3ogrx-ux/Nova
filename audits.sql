-- ============================================================================
-- Zenoa Agency — module Audits (à coller dans Supabase > SQL Editor > Run, relançable sans risque)
-- Les audits ne sont lisibles que par toi (admin). La page publique passe par la fonction audit-public (service role).
-- ============================================================================

create table if not exists public.audits (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title         text not null default 'Audit sans titre' check (char_length(title) between 1 and 160),
  client_name   text check (char_length(client_name) <= 160),
  status        text not null default 'draft' check (status in ('draft','published')),
  content       jsonb not null default '{"pages":[]}'::jsonb check (jsonb_typeof(content) = 'object' and char_length(content::text) <= 900000),
  cover_path    text check (char_length(cover_path) <= 300),   -- image dans le bucket user-resources
  logo_path     text check (char_length(logo_path) <= 300),
  slug          text unique check (slug ~ '^[A-Za-z0-9]{8,16}$'),
  password_hash text,                                         -- haché par la fonction audit-public, jamais lisible côté appli
  has_password  boolean not null default false,
  expires_at    timestamptz,
  is_template   boolean not null default false,
  template_kind text check (template_kind in ('seo','ads','site','social','blank','custom')),
  published_content jsonb,                                    -- dernière version publiée (le lien montre toujours celle-ci)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  published_at  timestamptz
);
create index if not exists audits_user_idx on public.audits (user_id, updated_at desc);

create table if not exists public.audit_views (
  id        uuid primary key default gen_random_uuid(),
  audit_id  uuid not null references public.audits(id) on delete cascade,
  viewed_at timestamptz not null default now()
);
create index if not exists audit_views_idx on public.audit_views (audit_id, viewed_at desc);

alter table public.audits enable row level security;
alter table public.audit_views enable row level security;

-- Audits : seulement les miens, et seulement pour un admin (même règle que la prospection).
drop policy if exists "mes audits" on public.audits;
create policy "mes audits" on public.audits for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "acces sur invitation" on public.audits;
create policy "acces sur invitation" on public.audits as restrictive for all to authenticated
  using (public.espace_admin_ok()) with check (public.espace_admin_ok());

-- Vues : lecture seule pour le propriétaire de l'audit. Les écritures viennent uniquement de la fonction audit-public.
drop policy if exists "mes vues" on public.audit_views;
create policy "mes vues" on public.audit_views for select to authenticated
  using (exists (select 1 from public.audits a where a.id = audit_id and a.user_id = auth.uid()));
drop policy if exists "acces sur invitation" on public.audit_views;
create policy "acces sur invitation" on public.audit_views as restrictive for all to authenticated
  using (public.espace_admin_ok()) with check (public.espace_admin_ok());

-- Droits par colonne : l'appli ne peut jamais lire password_hash, ni écrire le statut, le lien ou le mot de passe
-- (la publication passe par la fonction audit-public, qui vérifie que l'audit est bien à toi).
revoke all on public.audits from authenticated, anon;
grant select (id, user_id, title, client_name, status, content, cover_path, logo_path, slug, has_password, expires_at,
              is_template, template_kind, published_content, created_at, updated_at, published_at)
  on public.audits to authenticated;
grant insert (user_id, title, client_name, content, cover_path, logo_path, expires_at, is_template, template_kind)
  on public.audits to authenticated;
grant update (title, client_name, content, cover_path, logo_path, expires_at, is_template, template_kind, updated_at)
  on public.audits to authenticated;
grant delete on public.audits to authenticated;
revoke all on public.audit_views from anon, authenticated;
grant select on public.audit_views to authenticated;

-- Vues par audit (nombre + dernière ouverture), calculées sous mes droits.
create or replace function public.audit_view_stats()
returns table (audit_id uuid, vues bigint, derniere timestamptz)
language sql stable security invoker set search_path = public as $$
  select v.audit_id, count(*), max(v.viewed_at) from public.audit_views v group by v.audit_id;
$$;
grant execute on function public.audit_view_stats() to authenticated;
