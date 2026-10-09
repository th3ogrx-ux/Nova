-- ============================================================
-- NOVA / ZENOA — Page Ressources : templates, prompts, guides, outils.
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Ré-exécutable sans risque (sauf le bloc de données de test, à ne
-- coller qu'une seule fois — voir la note plus bas).
-- ============================================================

create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  category text not null,  -- "Templates", "Prompts", "Guides PDF", "Outils" (libre, sert juste à regrouper)
  title text not null,
  description text,
  -- 'file'   : bouton "Télécharger", utilise file_url.
  -- 'prompt' : bouton "Copier", utilise prompt_text.
  resource_type text not null default 'file' check (resource_type in ('file', 'prompt')),
  file_url text,
  prompt_text text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.resources enable row level security;

drop policy if exists "authenticated can read resources" on public.resources;
create policy "authenticated can read resources" on public.resources
  for select to authenticated using (true);

-- ============================================================
-- DONNÉES DE TEST — les 3 ressources demandées. Ne coller qu'UNE
-- SEULE FOIS (pas de contrainte d'unicité sur "title").
-- ============================================================

insert into public.resources (category, title, description, resource_type, prompt_text) values
  ('Prompts', 'Prompt pour écrire un script de vidéo', 'Un prompt prêt à copier pour générer un script de vidéo avec Claude Code.', 'prompt',
   'Aide-moi à écrire un script de vidéo de [durée] sur [sujet], avec une accroche, 3 idées principales et une conclusion claire.');

insert into public.resources (category, title, description, resource_type, file_url) values
  ('Templates', 'Template de plan de contenu', 'Un modèle pour planifier tes contenus semaine par semaine.', 'file', null),
  ('Guides PDF', 'Guide photo de profil IA (PDF)', 'Un guide pas à pas pour générer ta photo de profil avec l''IA.', 'file', null);

-- Remarque : file_url est laissé à null dans les données de test (pas
-- de vrai fichier à héberger pour l'instant). Pour un fichier réel,
-- héberge-le où tu veux (ex: Supabase Storage, un lien Google Drive en
-- partage public...) et mets son URL directe dans file_url — voir
-- "Comment ajouter une ressource" plus bas.

-- ============================================================
-- Comment ajouter une ressource plus tard (Supabase Dashboard > Table
-- Editor, ou SQL Editor) :
--
-- Un fichier à télécharger :
--   insert into public.resources (category, title, description, resource_type, file_url)
--   values ('Outils', 'Mon nouvel outil', 'Sa description courte.', 'file', 'https://.../fichier.pdf');
--
-- Un prompt à copier :
--   insert into public.resources (category, title, description, resource_type, prompt_text)
--   values ('Prompts', 'Mon nouveau prompt', 'Sa description courte.', 'prompt', 'Le texte du prompt ici.');
--
-- "category" est libre : toute nouvelle valeur crée automatiquement
-- une nouvelle catégorie sur la page (les 4 catégories "Templates",
-- "Prompts", "Guides PDF", "Outils" sont juste mises en avant en
-- premier si elles existent, les autres suivent par ordre alphabétique).
-- ============================================================
