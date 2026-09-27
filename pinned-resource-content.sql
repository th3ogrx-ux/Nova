-- ============================================================
-- ZENOA — Contenu de la ressource épinglée ("Tout savoir avant
-- de commencer"), affichée désormais comme une vidéo narrée.
-- À coller dans Supabase Dashboard > SQL Editor > Run.
-- Optionnel : ne lance ce script QUE si tu veux remplacer le
-- contenu actuel de ta ressource épinglée par les 7 points
-- ci-dessous (texte corrigé : "nova" -> "Zenoa").
-- ============================================================

do $$
declare
  pinned_id uuid;
  chef_id uuid;
begin
  select id into pinned_id from public.resource_categories where is_pinned = true limit 1;
  select id into chef_id from public.profiles where role = 'chef' limit 1;

  if pinned_id is null then
    raise notice 'Aucune ressource épinglée trouvée — rien à faire.';
  else
    delete from public.resource_items where category_id = pinned_id;

    insert into public.resource_items (category_id, content, created_by, created_at) values
      (pinned_id, '🎯 Mission : aider des coachs, entrepreneurs et entreprises à développer leur activité.', chef_id, now() + interval '0 second'),
      (pinned_id, '🤖 Services : agents IA, optimisation de sites web, création de chaînes YouTube, etc...', chef_id, now() + interval '1 second'),
      (pinned_id, '🧪 Début de collaboration (toi et Zenoa) : une période d''essai permet de vérifier si ton profil correspond aux besoins.', chef_id, now() + interval '2 second'),
      (pinned_id, '📩 Travail quotidien : envoyer au moins 25 DM personnalisés par jour et les enregistrer dans le journal des DMs.', chef_id, now() + interval '3 second'),
      (pinned_id, '💰 Rémunération : tu touches 30 % de commission sur les offres que tu vends.', chef_id, now() + interval '4 second'),
      (pinned_id, '📋 Projets : chaque projet doit être envoyé à Zenoa pour évaluer sa complexité et fixer le tarif adapté.', chef_id, now() + interval '5 second'),
      (pinned_id, '📊 Objectif global : assurer un suivi du projet, de sa mise en place jusqu''aux résultats.', chef_id, now() + interval '6 second');
  end if;
end $$;
