-- ============================================================================
-- Zenoa Agency — Mannequins, partenaires (marques, photographes, monteurs…) et leurs liens
-- (à coller dans Supabase > SQL Editor > Run, relançable sans risque ; à lancer APRÈS espace.sql, securite.sql, espace-reseaux.sql et equipe.sql)
-- Ajoute : annuaire de partenaires, liens partenaire <-> mannequin, comptes partenaires (accès limité),
-- suivi de collaboration en colonnes, et déplace les notes privées d'un client dans une table réservée à l'admin.
-- ============================================================================

-- ---------- Annuaire des partenaires ----------
create table if not exists public.espace_partners (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null check (char_length(nom) between 1 and 120),
  categorie   text not null default 'marque' check (categorie in ('marque', 'photographe', 'monteur', 'videaste', 'agence', 'styliste', 'maquilleur', 'autre')),
  statut      text not null default 'a_contacter' check (statut in ('a_contacter', 'contacte', 'en_discussion', 'actif', 'inactif')),
  contact_nom text check (char_length(contact_nom) <= 120),
  email       text check (char_length(email) <= 200),
  telephone   text check (char_length(telephone) <= 40),
  instagram   text check (char_length(instagram) <= 80),
  site        text check (char_length(site) <= 300),
  user_id     uuid unique references auth.users(id) on delete set null,   -- compte de connexion (facultatif)
  created_at  timestamptz not null default now()
);
-- Tarifs et notes : jamais visibles par le mannequin ni par le partenaire.
create table if not exists public.espace_partner_private (
  partner_id uuid primary key references public.espace_partners(id) on delete cascade,
  tarif      text check (char_length(tarif) <= 200),
  notes      text check (char_length(notes) <= 4000)
);
-- Quel partenaire travaille avec quel mannequin.
create table if not exists public.espace_partner_links (
  business_id uuid not null references public.espace_businesses(id) on delete cascade,
  partner_id  uuid not null references public.espace_partners(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (business_id, partner_id)
);
create index if not exists espace_partners_idx on public.espace_partners (categorie, statut);
create index if not exists espace_partner_links_idx on public.espace_partner_links (partner_id);

-- ---------- Notes privées d'un mannequin (avant : colonnes lisibles par le client lui-même) ----------
create table if not exists public.espace_private (
  business_id uuid primary key references public.espace_businesses(id) on delete cascade,
  objectifs   text check (char_length(objectifs) <= 2000),
  notes       text check (char_length(notes) <= 4000)
);
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'espace_businesses' and column_name = 'objectifs')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'espace_businesses' and column_name = 'notes_prospection') then
    insert into public.espace_private (business_id, objectifs, notes)
      select id, objectifs, notes_prospection from public.espace_businesses where objectifs is not null or notes_prospection is not null
      on conflict (business_id) do nothing;
    update public.espace_businesses set objectifs = null, notes_prospection = null where objectifs is not null or notes_prospection is not null;
  end if;
end $$;

-- ---------- Collaborations : lien vers un partenaire + suivi de la recherche en colonnes ----------
alter table public.espace_collabs add column if not exists partner_id uuid references public.espace_partners(id) on delete set null;
alter table public.espace_collabs drop constraint if exists espace_collabs_statut_check;
alter table public.espace_collabs add constraint espace_collabs_statut_check
  check (statut in ('a_contacter', 'contacte', 'reponse', 'negociation', 'signe', 'en_cours', 'publie', 'paye', 'refuse'));
alter table public.espace_collabs alter column statut set default 'a_contacter';
create index if not exists espace_collabs_partner_idx on public.espace_collabs (partner_id);

-- ---------- Fonctions ----------
-- Le partenaire connecté (null si ce compte n'est pas un partenaire).
create or replace function public.my_partner_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.espace_partners where user_id = auth.uid();
$$;
revoke all on function public.my_partner_id() from public;
grant execute on function public.my_partner_id() to authenticated;

-- Accès à l'espace (tables espace_*, fichiers, profils) : admin, client, membre de l'équipe ET partenaire.
create or replace function public.espace_access_ok()
returns boolean language plpgsql stable security definer set search_path = public as $$
begin
  if exists (select 1 from public.espace_profiles where id = auth.uid() and role in ('admin', 'client')) then return true; end if;
  if to_regclass('public.team_members') is not null and exists (select 1 from public.team_members where user_id = auth.uid()) then return true; end if;
  if to_regclass('public.espace_partners') is not null and exists (select 1 from public.espace_partners where user_id = auth.uid()) then return true; end if;
  return false;
end $$;
revoke all on function public.espace_access_ok() from public;
grant execute on function public.espace_access_ok() to authenticated;

-- ---------- Sécurité ----------
do $$
declare t text;
begin
  foreach t in array array['espace_partners', 'espace_partner_private', 'espace_partner_links', 'espace_private'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "admin gère" on public.%I', t);
    execute format('create policy "admin gère" on public.%I for all to authenticated using (public.espace_is_admin()) with check (public.espace_is_admin())', t);
    execute format('drop policy if exists "acces sur invitation" on public.%I', t);
    execute format('create policy "acces sur invitation" on public.%I as restrictive for all to authenticated using (public.espace_access_ok()) with check (public.espace_access_ok())', t);
  end loop;
end $$;

-- Le mannequin voit les partenaires qui lui sont associés (nom, métier, statut, contacts) ; le partenaire voit sa propre fiche.
drop policy if exists "mannequin lit ses partenaires" on public.espace_partners;
create policy "mannequin lit ses partenaires" on public.espace_partners for select to authenticated
  using (exists (select 1 from public.espace_partner_links l where l.partner_id = espace_partners.id and l.business_id = public.espace_my_business()));
drop policy if exists "partenaire lit sa fiche" on public.espace_partners;
create policy "partenaire lit sa fiche" on public.espace_partners for select to authenticated using (user_id = auth.uid());

drop policy if exists "mannequin lit ses liens" on public.espace_partner_links;
create policy "mannequin lit ses liens" on public.espace_partner_links for select to authenticated using (business_id = public.espace_my_business());
drop policy if exists "partenaire lit ses liens" on public.espace_partner_links;
create policy "partenaire lit ses liens" on public.espace_partner_links for select to authenticated using (partner_id = public.my_partner_id());

-- Le partenaire voit les mannequins avec qui il travaille, et ses propres collaborations.
drop policy if exists "partenaire lit ses mannequins" on public.espace_businesses;
create policy "partenaire lit ses mannequins" on public.espace_businesses for select to authenticated
  using (id in (select l.business_id from public.espace_partner_links l where l.partner_id = public.my_partner_id()));
-- Les étapes de recherche (à contacter, contactée, réponse reçue, refusée) restent internes : le mannequin et le partenaire
-- ne voient une collaboration qu'à partir de la négociation.
drop policy if exists "client lit les siennes" on public.espace_collabs;
create policy "client lit les siennes" on public.espace_collabs for select to authenticated
  using (business_id = public.espace_my_business() and statut in ('negociation', 'signe', 'en_cours', 'publie', 'paye'));
drop policy if exists "partenaire lit ses collabs" on public.espace_collabs;
create policy "partenaire lit ses collabs" on public.espace_collabs for select to authenticated
  using (partner_id = public.my_partner_id() and statut in ('negociation', 'signe', 'en_cours', 'publie', 'paye'));

-- ---------- Export RGPD : inclut partenaires liés et notes privées ----------
create or replace function public.espace_export_business(p_business_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.espace_is_admin() then raise exception 'Réservé à l''administrateur.'; end if;
  select jsonb_build_object(
    'exporte_le', now(),
    'commerce', (select to_jsonb(b) from public.espace_businesses b where b.id = p_business_id),
    'notes_privees', (select to_jsonb(p) from public.espace_private p where p.business_id = p_business_id),
    'chiffres_mensuels', coalesce((select jsonb_agg(to_jsonb(s)) from public.espace_monthly_stats s where s.business_id = p_business_id), '[]'),
    'avis', coalesce((select jsonb_agg(to_jsonb(r)) from public.espace_reviews r where r.business_id = p_business_id), '[]'),
    'chiffres_reseaux', coalesce((select jsonb_agg(to_jsonb(s)) from public.espace_social_stats s where s.business_id = p_business_id), '[]'),
    'calendrier', coalesce((select jsonb_agg(to_jsonb(p)) from public.espace_posts p where p.business_id = p_business_id), '[]'),
    'collaborations', coalesce((select jsonb_agg(to_jsonb(c)) from public.espace_collabs c where c.business_id = p_business_id), '[]'),
    'partenaires_lies', coalesce((select jsonb_agg(jsonb_build_object('nom', x.nom, 'categorie', x.categorie)) from public.espace_partner_links l join public.espace_partners x on x.id = l.partner_id where l.business_id = p_business_id), '[]'),
    'taches', coalesce((select jsonb_agg(to_jsonb(t)) from public.espace_tasks t where t.business_id = p_business_id), '[]'),
    'messages', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from public.espace_messages m where m.business_id = p_business_id), '[]')
  ) into result;
  insert into public.audit_log (type, actor, business_id) values ('data_exported', auth.uid(), p_business_id);
  return result;
end $$;
revoke all on function public.espace_export_business(uuid) from public;
grant execute on function public.espace_export_business(uuid) to authenticated;

notify pgrst, 'reload schema';
