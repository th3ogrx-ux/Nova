-- ============================================================
-- NOVA / ZENOA — Panneau Admin : sécurité, Tableau de bord, Élèves,
-- Contenu, Retours, Accès et codes.
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque (sauf le bloc de migration des
-- nouveautés tout en bas, à ne coller qu'une seule fois).
--
-- "Admin" = ton compte, celui qui a role = 'chef' dans profiles (le
-- rôle déjà utilisé partout dans le site depuis le début — on ne
-- renomme rien, on s'appuie dessus). "Élève" = role = 'membre'.
-- ============================================================

-- ----- Qui est admin ? Une seule fonction, réutilisée dans toutes
-- les policies ci-dessous (et par le code PostgREST) pour que la
-- définition d'"admin" ne vive qu'à un seul endroit. -----
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'chef'
  );
$$;
grant execute on function public.is_admin() to authenticated;

-- ============================================================
-- PROFILES — colonnes admin (en plus de is_active et created_at qui
-- existent déjà et sont réutilisées telles quelles).
-- ============================================================

alter table public.profiles
  add column if not exists last_seen_at timestamptz,
  add column if not exists access_expires_at timestamptz,
  add column if not exists admin_notes text;

-- Les policies "user can update own profile" / lecture de son propre
-- profil existent déjà (depuis settings-profile-account.sql) : on
-- AJOUTE l'accès admin à TOUS les profils, sans toucher à l'existant.
drop policy if exists "admin can read all profiles" on public.profiles;
create policy "admin can read all profiles" on public.profiles
  for select to authenticated using (public.is_admin());

drop policy if exists "admin can update all profiles" on public.profiles;
create policy "admin can update all profiles" on public.profiles
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Suppression d'un compte élève par l'admin (RGPD / "Supprimer le
-- compte") : supprime le profil ET le compte d'authentification, avec
-- une vraie vérification de rôle CÔTÉ SERVEUR à l'intérieur de la
-- fonction (pas seulement une policy) — même esprit que
-- delete_my_account(), mais pour un autre utilisateur, réservé à
-- l'admin.
create or replace function public.admin_delete_student(student_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Accès refusé : réservé à l''administrateur.';
  end if;
  delete from public.profiles where id = student_id;
  delete from auth.users where id = student_id;
end;
$$;
grant execute on function public.admin_delete_student(uuid) to authenticated;

-- ============================================================
-- ACCESS_CODES — table déjà existante (le code-entry du site s'en
-- sert déjà pour l'inscription, via la fonction claim_access_code
-- existante, qu'on ne touche pas). On ajoute juste les colonnes de
-- gestion admin, et on sécurise l'écriture (avant, n'importe quel
-- compte connecté aurait pu modifier/créer des codes directement :
-- c'est corrigé ici).
-- ============================================================

alter table public.access_codes
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists note text,                    -- ex: "virement le 12/10" — jamais de donnée bancaire
  add column if not exists disabled boolean not null default false,
  add column if not exists expires_access_days int,       -- durée d'accès prévue (voir remarque plus bas)
  add column if not exists intended_pseudo text,          -- pour qui ce code a été généré (info admin uniquement)
  add column if not exists intended_email text;

alter table public.access_codes enable row level security;

-- La vérification du code AVANT connexion (écran d'accueil) se fait
-- sans session (utilisateur anonyme) : la lecture doit donc rester
-- ouverte, exactement comme avant (le vrai verrou reste le code
-- aléatoire difficile à deviner). On ne restreint que l'écriture.
drop policy if exists "anyone can preview a code" on public.access_codes;
create policy "anyone can preview a code" on public.access_codes
  for select using (true);

drop policy if exists "admin can create codes" on public.access_codes;
create policy "admin can create codes" on public.access_codes
  for insert to authenticated with check (public.is_admin());

drop policy if exists "admin can update codes" on public.access_codes;
create policy "admin can update codes" on public.access_codes
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Remarque importante : "expires_access_days" est la durée D'ACCÈS
-- prévue par l'admin au moment de créer le code, mais la fonction
-- claim_access_code() existante (pas écrite par cette session, donc
-- pas modifiée ici pour ne rien casser) ne la lit pas automatiquement
-- pour remplir profiles.access_expires_at. En pratique : utilise le
-- bouton "Prolonger l'accès" sur la fiche de l'élève une fois son
-- compte créé pour fixer sa vraie date d'expiration. Si tu veux que
-- ce soit automatique, montre-moi le code actuel de
-- claim_access_code (select pg_get_functiondef('public.claim_access_code'::regproc);)
-- et je le brancherai proprement.
--
-- Autre limite assumée : désactiver un code (disabled = true) le
-- masque et empêche l'admin de le repartager, mais je n'ai pas la
-- certitude que claim_access_code() vérifie elle-même ce champ (même
-- raison : je ne l'ai pas écrite). Même requête ci-dessus si tu veux
-- que ce soit garanti.

-- ============================================================
-- PROJECT_SUBMISSIONS — ajoute le retour de l'admin (page Retours),
-- visible par l'élève dans sa page "Mon projet".
-- ============================================================

alter table public.project_submissions
  add column if not exists admin_feedback text,
  add column if not exists corrected boolean not null default false,
  add column if not exists corrected_at timestamptz;

drop policy if exists "admin can read all submissions" on public.project_submissions;
create policy "admin can read all submissions" on public.project_submissions
  for select to authenticated using (public.is_admin());

drop policy if exists "admin can update submissions" on public.project_submissions;
create policy "admin can update submissions" on public.project_submissions
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- L'admin doit aussi pouvoir voir les fichiers déposés par les
-- élèves (bucket privé project-uploads, créé par mon-projet.sql, qui
-- ne laissait jusqu'ici chaque élève voir que son propre dossier).
drop policy if exists "admin can read all project files" on storage.objects;
create policy "admin can read all project files" on storage.objects
  for select to authenticated using (bucket_id = 'project-uploads' and public.is_admin());

-- ============================================================
-- CONTENU — l'admin peut maintenant gérer modules/leçons/ressources
-- depuis l'app (plus seulement par SQL). Ajout aussi du statut
-- brouillon/publié sur les leçons : les élèves ne voient que les
-- leçons publiées (déjà garanti par la policy ci-dessous, pas besoin
-- de filtrer côté app), l'admin voit tout.
-- ============================================================

alter table public.course_lessons
  add column if not exists status text not null default 'published' check (status in ('draft', 'published'));

drop policy if exists "authenticated can read lessons" on public.course_lessons;
drop policy if exists "eleve can read published lessons" on public.course_lessons;
create policy "eleve can read published lessons" on public.course_lessons
  for select to authenticated using (status = 'published');

drop policy if exists "admin can read all lessons" on public.course_lessons;
create policy "admin can read all lessons" on public.course_lessons
  for select to authenticated using (public.is_admin());

drop policy if exists "admin can write lessons" on public.course_lessons;
create policy "admin can write lessons" on public.course_lessons
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin can write modules" on public.course_modules;
create policy "admin can write modules" on public.course_modules
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin can write resources" on public.resources;
create policy "admin can write resources" on public.resources
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin can write events" on public.calendar_events;
create policy "admin can write events" on public.calendar_events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ----- Nouveautés de la page Accueil -----
-- Remplace le tableau ACCUEIL_NEWS codé en dur dans chat-widget.js
-- (ça avait du sens avant que l'admin ait une vraie page Contenu —
-- maintenant que c'est le cas, autant que ce soit géré ici).
create table if not exists public.home_news (
  id uuid primary key default gen_random_uuid(),
  position int not null default 0,
  date_label text not null,       -- texte libre affiché tel quel (ex: "Oct.")
  title text not null,
  link_view text,                 -- optionnel : nom de page existante ("resources", "calendrier"...)
  created_at timestamptz not null default now()
);

alter table public.home_news enable row level security;

drop policy if exists "authenticated can read news" on public.home_news;
create policy "authenticated can read news" on public.home_news
  for select to authenticated using (true);

drop policy if exists "admin can write news" on public.home_news;
create policy "admin can write news" on public.home_news
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Migration des 3 nouveautés qui étaient codées en dur dans
-- chat-widget.js, pour ne rien perdre. Ne coller qu'UNE SEULE FOIS
-- (pas de contrainte d'unicité sur le titre).
-- ============================================================

insert into public.home_news (position, date_label, title, link_view) values
  (1, 'Oct.', 'Nouveau design de l''espace membre', null),
  (2, 'Oct.', 'Page Ressources mise à jour', 'resources'),
  (3, 'Oct.', 'Calendrier disponible', 'calendrier');
