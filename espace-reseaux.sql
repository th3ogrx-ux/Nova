-- ============================================================================
-- Zenoa Agency — Espace client « réseaux sociaux » : marques, mannequins, créateurs
-- (à coller dans Supabase > SQL Editor > Run, relançable sans risque ; à lancer APRÈS espace.sql et securite.sql — et à relancer si tu recolles securite.sql, qui remet l'ancien export RGPD)
-- Ajoute : type de client, réseaux suivis (Instagram, TikTok, LinkedIn), statistiques par réseau,
-- calendrier de contenu partagé, campagnes et collaborations. Les clients existants ne changent pas.
-- ============================================================================

-- ---------- Fiche client : type, réseaux, parties affichées ----------
alter table public.espace_businesses add column if not exists type text not null default 'local';
alter table public.espace_businesses add column if not exists reseaux text[] not null default '{}';
alter table public.espace_businesses add column if not exists sections text[] not null default array['chiffres', 'avis'];
alter table public.espace_businesses add column if not exists comptes jsonb not null default '{}'::jsonb;

alter table public.espace_businesses drop constraint if exists espace_businesses_type_ok;
alter table public.espace_businesses add constraint espace_businesses_type_ok check (type in ('local', 'marque', 'mannequin', 'createur', 'autre'));
alter table public.espace_businesses drop constraint if exists espace_businesses_reseaux_ok;
alter table public.espace_businesses add constraint espace_businesses_reseaux_ok check (reseaux <@ array['instagram', 'tiktok', 'linkedin']::text[]);
alter table public.espace_businesses drop constraint if exists espace_businesses_sections_ok;
alter table public.espace_businesses add constraint espace_businesses_sections_ok check (sections <@ array['chiffres', 'avis', 'reseaux', 'calendrier', 'collabs']::text[]);
alter table public.espace_businesses drop constraint if exists espace_businesses_comptes_ok;
alter table public.espace_businesses add constraint espace_businesses_comptes_ok check (jsonb_typeof(comptes) = 'object' and char_length(comptes::text) <= 1000);

-- ---------- Statistiques mensuelles par réseau ----------
create table if not exists public.espace_social_stats (
  business_id  uuid not null references public.espace_businesses(id) on delete cascade,
  mois         date not null check (mois = date_trunc('month', mois)::date),
  reseau       text not null check (reseau in ('instagram', 'tiktok', 'linkedin')),
  abonnes      integer not null default 0 check (abonnes between 0 and 2000000000),   -- total en fin de mois
  vues         integer not null default 0 check (vues between 0 and 2000000000),
  portee       integer not null default 0 check (portee between 0 and 2000000000),
  interactions integer not null default 0 check (interactions between 0 and 2000000000), -- likes + commentaires + partages + enregistrements
  publications integer not null default 0 check (publications between 0 and 100000),
  updated_at   timestamptz not null default now(),
  primary key (business_id, mois, reseau)
);

-- ---------- Calendrier de contenu partagé ----------
create table if not exists public.espace_posts (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.espace_businesses(id) on delete cascade,
  date_prevue date not null,
  reseau      text not null check (reseau in ('instagram', 'tiktok', 'linkedin')),
  format      text not null default 'post' check (format in ('post', 'reel', 'story', 'video', 'carrousel', 'article')),
  titre       text not null check (char_length(titre) between 1 and 160),
  legende     text check (char_length(legende) <= 2000),
  visuel_url  text check (char_length(visuel_url) <= 500),
  statut      text not null default 'prevu' check (statut in ('prevu', 'publie')),
  created_at  timestamptz not null default now()
);

-- ---------- Campagnes et collaborations ----------
create table if not exists public.espace_collabs (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.espace_businesses(id) on delete cascade,
  marque      text not null check (char_length(marque) between 1 and 120),
  nature      text not null default 'collab' check (nature in ('collab', 'campagne', 'shooting', 'evenement', 'autre')),
  statut      text not null default 'negociation' check (statut in ('negociation', 'signe', 'en_cours', 'publie', 'paye')),
  montant     numeric(10, 2) check (montant >= 0),
  date_prevue date,
  notes       text check (char_length(notes) <= 1000),   -- visible par le client
  created_at  timestamptz not null default now()
);

create index if not exists espace_social_stats_idx on public.espace_social_stats (business_id, mois desc);
create index if not exists espace_posts_idx        on public.espace_posts (business_id, date_prevue);
create index if not exists espace_collabs_idx      on public.espace_collabs (business_id, created_at desc);

-- ---------- Sécurité (même règles que les autres tables espace_*) ----------
do $$
declare t text;
begin
  foreach t in array array['espace_social_stats', 'espace_posts', 'espace_collabs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "admin gère" on public.%I', t);
    execute format('create policy "admin gère" on public.%I for all to authenticated using (public.espace_is_admin()) with check (public.espace_is_admin())', t);
    execute format('drop policy if exists "client lit les siennes" on public.%I', t);
    execute format('create policy "client lit les siennes" on public.%I for select to authenticated using (business_id = public.espace_my_business())', t);
    -- règle « accès sur invitation » (comme securite.sql) : seulement admin / client / équipe
    if to_regprocedure('public.espace_access_ok()') is not null then
      execute format('drop policy if exists "acces sur invitation" on public.%I', t);
      execute format('create policy "acces sur invitation" on public.%I as restrictive for all to authenticated using (public.espace_access_ok()) with check (public.espace_access_ok())', t);
    else
      raise notice 'securite.sql n''est pas installé : lance-le puis relance ce fichier.';
    end if;
  end loop;
end $$;

-- ---------- Export RGPD : inclut les nouvelles données ----------
create or replace function public.espace_export_business(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.espace_is_admin() then raise exception 'Réservé à l''administrateur.'; end if;
  select jsonb_build_object(
    'exporte_le', now(),
    'commerce', (select to_jsonb(b) from public.espace_businesses b where b.id = p_business_id),
    'chiffres_mensuels', coalesce((select jsonb_agg(to_jsonb(s)) from public.espace_monthly_stats s where s.business_id = p_business_id), '[]'),
    'chiffres_reseaux', coalesce((select jsonb_agg(to_jsonb(s)) from public.espace_social_stats s where s.business_id = p_business_id), '[]'),
    'calendrier', coalesce((select jsonb_agg(to_jsonb(p)) from public.espace_posts p where p.business_id = p_business_id), '[]'),
    'collaborations', coalesce((select jsonb_agg(to_jsonb(c)) from public.espace_collabs c where c.business_id = p_business_id), '[]'),
    'avis', coalesce((select jsonb_agg(to_jsonb(r)) from public.espace_reviews r where r.business_id = p_business_id), '[]'),
    'taches', coalesce((select jsonb_agg(to_jsonb(t)) from public.espace_tasks t where t.business_id = p_business_id), '[]'),
    'messages', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.espace_messages m where m.business_id = p_business_id), '[]')
  ) into result;
  insert into public.audit_log (type, actor, business_id) values ('data_exported', auth.uid(), p_business_id);
  return result;
end $$;
revoke all on function public.espace_export_business(uuid) from public;
grant execute on function public.espace_export_business(uuid) to authenticated;

notify pgrst, 'reload schema';
