-- ============================================================
-- ZENOA — Espace clients : DONNÉES D'EXEMPLE (démonstration)
-- 2 commerces fictifs (un barbier, un plombier) : 6 mois de chiffres,
-- 15 avis, des tâches et des messages. Tout est marqué is_example = true
-- et porte "(exemple)" dans le nom.
-- À coller dans Supabase > SQL Editor > Run (après espace.sql).
-- Ré-exécutable : remplace les exemples à chaque fois, sans toucher à
-- tes vrais clients.
-- Pour tout supprimer :  delete from public.espace_businesses where is_example;
-- ============================================================

delete from public.espace_businesses where is_example;   -- (supprime en cascade chiffres, avis, tâches, messages)

insert into public.espace_businesses (id, nom, secteur, ville, lien_avis_google, is_example) values
  ('e1111111-1111-4111-8111-111111111111', 'Barbier Le Fade (exemple)', 'Barbier', 'Lyon',
   'https://search.google.com/local/writereview?placeid=EXEMPLE_BARBIER', true),
  ('e2222222-2222-4222-8222-222222222222', 'Plomberie Garnier (exemple)', 'Plombier', 'Nantes',
   'https://search.google.com/local/writereview?placeid=EXEMPLE_PLOMBIER', true);

-- Chiffres : les 6 derniers mois complets (n = 1 → il y a 6 mois ... n = 6 → le mois dernier)
insert into public.espace_monthly_stats (business_id, mois, appels, itineraires, vues_fiche, visites_site)
select 'e1111111-1111-4111-8111-111111111111',
       (date_trunc('month', current_date) - (7 - n) * interval '1 month')::date,
       (array[52,58,61,70,74,83])[n], (array[31,35,40,44,49,55])[n],
       (array[1480,1620,1750,1900,2100,2350])[n], (array[210,240,260,300,330,380])[n]
from generate_series(1, 6) n;

insert into public.espace_monthly_stats (business_id, mois, appels, itineraires, vues_fiche, visites_site)
select 'e2222222-2222-4222-8222-222222222222',
       (date_trunc('month', current_date) - (7 - n) * interval '1 month')::date,
       (array[38,41,47,44,52,57])[n], (array[12,14,15,13,17,19])[n],
       (array[920,980,1100,1060,1210,1300])[n], (array[120,130,150,140,170,185])[n]
from generate_series(1, 6) n;

-- Avis (8 + 7 = 15) : certains attendent encore une réponse
insert into public.espace_reviews (business_id, auteur, note, texte, date, repondu, reponse) values
  ('e1111111-1111-4111-8111-111111111111', 'Karim', 5, 'Coupe impeccable, accueil au top. Je recommande !', current_date - 150, true, 'Merci Karim, à très vite !'),
  ('e1111111-1111-4111-8111-111111111111', 'Julien', 4, 'Très bon dégradé, un peu d''attente le samedi.', current_date - 120, true, 'Merci Julien, on affine nos horaires du samedi.'),
  ('e1111111-1111-4111-8111-111111111111', 'Thomas', 5, 'Le meilleur barbier du quartier.', current_date - 95, true, 'Merci Thomas !'),
  ('e1111111-1111-4111-8111-111111111111', 'Maxime', 3, 'Bien, mais difficile de prendre rendez-vous.', current_date - 70, true, 'Merci pour votre retour : la prise de rendez-vous en ligne arrive.'),
  ('e1111111-1111-4111-8111-111111111111', 'Hugo', 5, 'Barbe parfaite, ambiance sympa.', current_date - 48, true, 'Merci Hugo !'),
  ('e1111111-1111-4111-8111-111111111111', 'Samir', 5, 'Super service, prix corrects.', current_date - 30, false, null),
  ('e1111111-1111-4111-8111-111111111111', 'Lucas', 4, 'Très pro, je reviendrai.', current_date - 14, false, null),
  ('e1111111-1111-4111-8111-111111111111', 'Nadia', 2, 'Rendez-vous décalé de 20 minutes sans prévenir.', current_date - 5, false, null),
  ('e2222222-2222-4222-8222-222222222222', 'Mme Dupont', 5, 'Intervention rapide un dimanche, très pro.', current_date - 160, true, 'Merci Madame Dupont !'),
  ('e2222222-2222-4222-8222-222222222222', 'Pierre', 5, 'Fuite réparée en une heure, tarif clair.', current_date - 130, true, 'Merci Pierre.'),
  ('e2222222-2222-4222-8222-222222222222', 'Sophie', 4, 'Bon travail, devis respecté.', current_date - 100, true, 'Merci Sophie.'),
  ('e2222222-2222-4222-8222-222222222222', 'Marc', 1, 'Arrivé en retard et sans prévenir.', current_date - 75, true, 'Désolé Marc, nous avons revu notre organisation.'),
  ('e2222222-2222-4222-8222-222222222222', 'Claire', 5, 'Chauffe-eau changé proprement, merci.', current_date - 50, true, 'Merci Claire !'),
  ('e2222222-2222-4222-8222-222222222222', 'Antoine', 4, 'Plombier sérieux et ponctuel.', current_date - 22, false, null),
  ('e2222222-2222-4222-8222-222222222222', 'Julie', 5, 'Dépannage rapide, très aimable.', current_date - 8, false, null);

-- Tâches du mois en cours
insert into public.espace_tasks (business_id, titre, statut, mois) values
  ('e1111111-1111-4111-8111-111111111111', 'Mettre à jour les photos de la fiche Google', 'fait', date_trunc('month', current_date)::date),
  ('e1111111-1111-4111-8111-111111111111', 'Répondre aux nouveaux avis', 'en_cours', date_trunc('month', current_date)::date),
  ('e1111111-1111-4111-8111-111111111111', 'Publier un post Google (offre du mois)', 'a_venir', date_trunc('month', current_date)::date),
  ('e1111111-1111-4111-8111-111111111111', 'Ajouter les horaires de fin d''année', 'a_venir', date_trunc('month', current_date)::date),
  ('e2222222-2222-4222-8222-222222222222', 'Ajouter la zone d''intervention sur la fiche', 'fait', date_trunc('month', current_date)::date),
  ('e2222222-2222-4222-8222-222222222222', 'Optimiser la page « Urgences 24h/24 » du site', 'en_cours', date_trunc('month', current_date)::date),
  ('e2222222-2222-4222-8222-222222222222', 'Collecter 5 nouveaux avis clients', 'a_venir', date_trunc('month', current_date)::date);

-- Messages (la messagerie arrive à l'étape 4)
insert into public.espace_messages (business_id, auteur, texte, created_at, lu) values
  ('e1111111-1111-4111-8111-111111111111', 'admin', 'Bonjour ! Voici le récapitulatif du mois, n''hésitez pas si vous avez des questions.', now() - interval '6 days', true),
  ('e1111111-1111-4111-8111-111111111111', 'client', 'Merci ! Pouvez-vous ajouter nos horaires de fin d''année ?', now() - interval '5 days', true),
  ('e1111111-1111-4111-8111-111111111111', 'admin', 'C''est noté, je m''en occupe cette semaine.', now() - interval '2 days', false),
  ('e2222222-2222-4222-8222-222222222222', 'admin', 'Bonjour, la fiche est à jour. Les appels progressent bien ce mois-ci.', now() - interval '10 days', true),
  ('e2222222-2222-4222-8222-222222222222', 'client', 'Super, merci pour le suivi !', now() - interval '9 days', true);
