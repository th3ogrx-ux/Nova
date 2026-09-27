-- ============================================================
-- ZENOA — Deuxième vidéo de Ressources : présentation de la
-- partie Setter de l'application.
-- À coller dans Supabase Dashboard > SQL Editor > Run
-- Ré-exécutable sans risque.
-- ============================================================

alter table public.resource_categories add column if not exists is_setter_tour boolean not null default false;

-- Crée la catégorie + son contenu si elle n'existe pas encore.
do $$
declare
  cat_id uuid;
  chef_id uuid;
begin
  select id into cat_id from public.resource_categories where is_setter_tour = true limit 1;
  if cat_id is not null then
    raise notice 'La présentation Setter existe déjà — rien à faire.';
    return;
  end if;

  select id into chef_id from public.profiles where role = 'chef' limit 1;

  insert into public.resource_categories (title, created_by, is_setter_tour)
  values ('Présentation — Partie Setter', chef_id, true)
  returning id into cat_id;

  insert into public.resource_items (category_id, content, created_by, sort_order, created_at) values
    (cat_id, '🧭 Bienvenue dans la partie Setter de ZENOA — voici un tour rapide de l''application.', chef_id, 0, now() + interval '0 second'),
    (cat_id, '📨 Journal de DMs : enregistre chaque DM envoyé, ses réponses et tes ventes, jour après jour.', chef_id, 1, now() + interval '1 second'),
    (cat_id, '👥 Équipe : retrouve tous les membres de l''agence, leurs rôles et leurs badges.', chef_id, 2, now() + interval '2 second'),
    (cat_id, '📬 BoxMail : ta messagerie privée avec le reste de l''équipe, pour les échanges importants et tes contrats.', chef_id, 3, now() + interval '3 second'),
    (cat_id, '📚 Ressources : tous les documents et informations utiles pour bien travailler.', chef_id, 4, now() + interval '4 second'),
    (cat_id, '📅 Calendrier : les points d''avancement partagés par toute l''équipe — ajoute les tiens.', chef_id, 5, now() + interval '5 second'),
    (cat_id, '⚙️ Paramètres : gère ton profil, ta photo, et active les notifications pour ne rien manquer.', chef_id, 6, now() + interval '6 second');
end $$;
