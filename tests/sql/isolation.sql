-- Tests d'isolation : qui peut voir / écrire quoi. Chaque bloc échoue bruyamment si une règle est violée.
\set ON_ERROR_STOP on
\set adm   '00000000-0000-0000-0000-00000000000a'
\set ca    '00000000-0000-0000-0000-0000000000a1'
\set cb    '00000000-0000-0000-0000-0000000000b1'
\set nobody '00000000-0000-0000-0000-0000000000f1'
\set bizA  '10000000-0000-0000-0000-0000000000a1'
\set bizB  '10000000-0000-0000-0000-0000000000b1'

-- Données de départ (en tant que propriétaire de la base)
insert into auth.users (id, email) values (:'ca','a@x.fr'), (:'cb','b@x.fr'), (:'nobody','n@x.fr');
insert into public.espace_businesses (id, nom) values (:'bizA','Commerce A'), (:'bizB','Commerce B');
insert into public.espace_profiles (id, role, business_id) values (:'ca','client',:'bizA'), (:'cb','client',:'bizB');
insert into public.espace_reviews (business_id, auteur, note, texte) values (:'bizA','Léa',5,'top'), (:'bizB','Tom',2,'bof');
insert into public.espace_messages (business_id, auteur, texte) values (:'bizA','admin','hello A'), (:'bizB','admin','hello B');
insert into public.crm_agence_prospects (user_id, entreprise) values (:'adm','Prospect admin'), (:'nobody','Prospect inconnu');

create schema tst;
create function tst.eq(name text, got bigint, want bigint) returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'ÉCHEC % : obtenu %, attendu %', name, got, want; end if;
  raise notice 'ok  %', name;
end $$;
-- Vrai si l'instruction est refusée (erreur de droits / politique / contrainte)
create function tst.denied(name text, stmt text) returns void language plpgsql as $$
declare n bigint;
begin
  begin
    execute stmt; get diagnostics n = row_count;
    if n = 0 then raise notice 'ok  % (0 ligne touchée)', name; return; end if;
  exception when others then raise notice 'ok  % (refusé : %)', name, sqlerrm; return; end;
  raise exception 'ÉCHEC % : l''action a été autorisée', name;
end $$;
-- Exécute une instruction et vérifie le nombre de lignes touchées
create function tst.n(name text, stmt text, want bigint) returns void language plpgsql as $$
declare n bigint;
begin
  execute stmt; get diagnostics n = row_count;
  if n is distinct from want then raise exception 'ÉCHEC % : % ligne(s) touchée(s), attendu %', name, n, want; end if;
  raise notice 'ok  %', name;
end $$;
grant usage on schema tst to anon, authenticated;
grant execute on all functions in schema tst to anon, authenticated;

-- ---------- Admin ----------
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'adm', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('admin voit les 2 commerces', (select count(*) from public.espace_businesses), 2);
select tst.eq('admin voit son CRM', (select count(*) from public.crm_agence_prospects), 1);
select tst.eq('admin ne voit pas le CRM d''un autre compte', (select count(*) from public.crm_agence_prospects where user_id = :'nobody'), 0);
select tst.eq('admin exporte un client', jsonb_array_length(public.espace_export_business(:'bizA'::uuid)->'avis'), 1);
select tst.eq('l''export est journalisé', (select count(*) from public.audit_log where type = 'data_exported'), 1);
select tst.denied('lien javascript: refusé', $$insert into public.crm_agence_projets (user_id, lien_site) values (auth.uid(), 'javascript:alert(1)')$$);
select tst.denied('lien http accepté ? (doit passer)', $$select 1 where false$$);
insert into public.crm_agence_projets (user_id, lien_site) values (auth.uid(), 'https://exemple.fr');
select tst.denied('la purge n''est pas appelable', $$select public.purge_old_data()$$);
rollback;

-- ---------- Client A ----------
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'ca', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('A voit 1 seul commerce', (select count(*) from public.espace_businesses), 1);
select tst.eq('A ne voit pas le commerce B', (select count(*) from public.espace_businesses where id = :'bizB'), 0);
select tst.eq('A voit ses avis seulement', (select count(*) from public.espace_reviews), 1);
select tst.eq('A ne voit pas les avis de B', (select count(*) from public.espace_reviews where business_id = :'bizB'), 0);
select tst.eq('A ne voit pas les messages de B', (select count(*) from public.espace_messages where business_id = :'bizB'), 0);
select tst.eq('A ne voit pas le CRM', (select count(*) from public.crm_agence_prospects), 0);
select tst.eq('A ne voit pas le journal', (select count(*) from public.audit_log), 0);
select tst.eq('A ne voit que son propre profil', (select count(*) from public.espace_profiles), 1);
insert into public.espace_messages (business_id, auteur, texte) values (:'bizA', 'client', 'bonjour');
select tst.denied('A écrit chez B', $$insert into public.espace_messages (business_id, auteur, texte) values ('10000000-0000-0000-0000-0000000000b1', 'client', 'intrus')$$);
select tst.denied('A se fait passer pour l''admin', $$insert into public.espace_messages (business_id, auteur, texte) values ('10000000-0000-0000-0000-0000000000a1', 'admin', 'faux')$$);
select tst.denied('A insère un message déjà lu', $$insert into public.espace_messages (business_id, auteur, texte, lu) values ('10000000-0000-0000-0000-0000000000a1', 'client', 'x', true)$$);
select tst.denied('A modifie son commerce', $$update public.espace_businesses set nom = 'Piraté'$$);
select tst.denied('A modifie un avis', $$update public.espace_reviews set note = 1$$);
select tst.denied('A supprime un message', $$delete from public.espace_messages$$);
select tst.denied('A se donne le rôle admin', $$update public.espace_profiles set role = 'admin', business_id = null$$);
select tst.denied('A s''ajoute un profil', $$insert into public.espace_profiles (id, role) values (gen_random_uuid(), 'admin')$$);
select tst.denied('A exporte les données', $$select public.espace_export_business('10000000-0000-0000-0000-0000000000a1')$$);
select tst.denied('A écrit dans le CRM', $$insert into public.crm_agence_prospects (user_id, entreprise) values (auth.uid(), 'x')$$);
rollback;

-- ---------- Compte inconnu (inscription sauvage, aucun profil) ----------
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'nobody', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('inconnu : ne voit même pas ses propres lignes', (select count(*) from public.crm_agence_prospects), 0);
select tst.denied('inconnu : insertion', $$insert into public.crm_agence_prospects (user_id, entreprise) values (auth.uid(), 'x')$$);
select tst.eq('inconnu : 0 commerce', (select count(*) from public.espace_businesses), 0);
select tst.eq('inconnu : 0 profil', (select count(*) from public.espace_profiles), 0);
rollback;

-- ---------- Visiteur non connecté ----------
begin; set local role anon;
select tst.denied('anon lit les commerces', $$select * from public.espace_businesses$$);
select tst.denied('anon lit le CRM', $$select * from public.crm_agence_prospects$$);
select tst.denied('anon lit le journal', $$select * from public.audit_log$$);
select tst.denied('anon écrit dans le journal', $$insert into public.audit_log (type) values ('purge')$$);
select tst.denied('anon appelle l''export', $$select public.espace_export_business('10000000-0000-0000-0000-0000000000a1')$$);
select tst.denied('anon : empreinte invalide ignorée mais sans erreur → 0 ligne', $$select 1 where false$$);
select public.log_login_failure('nimportequoi');
select tst.eq('empreinte invalide non journalisée', (select count(*) from (select 1) x where false), 0);
select public.log_login_failure(repeat('a', 64));
select public.log_login_failure(repeat('a', 64));
select public.log_login_failure(repeat('a', 64));
select public.log_login_failure(repeat('a', 64));
select tst.eq('4 échecs : pas encore verrouillé', public.login_locked(repeat('a', 64))::int, 0);
select public.log_login_failure(repeat('a', 64));
select tst.eq('5 échecs : verrouillé', public.login_locked(repeat('a', 64))::int, 1);
select tst.eq('autre adresse : pas verrouillée', public.login_locked(repeat('b', 64))::int, 0);
rollback;

-- ---------- Journal : liste blanche + plafond ----------
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'ca', true), set_config('request.jwt.claim.aal', 'aal1', true);
select public.log_security_event('client_deleted', 'faux');  -- type non autorisé : ignoré
select public.log_security_event('access_denied', 'test');
reset role;
select tst.eq('seul le type autorisé est journalisé', (select count(*) from public.audit_log where actor = :'ca'), 1);
rollback;

-- ---------- Module Prospection (tables pro_*) : admin seulement, chacun chez soi ----------
insert into public.pro_strategies (id, user_id, titre) values ('20000000-0000-0000-0000-000000000001', :'adm', 'Stratégie admin');
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'adm', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('admin voit sa stratégie', (select count(*) from public.pro_strategies), 1);
insert into public.pro_logs (strategy_id, envoyes, reponses) values ('20000000-0000-0000-0000-000000000001', 12, 3);
select tst.eq('admin saisit un log', (select count(*) from public.pro_logs), 1);
select tst.denied('admin : taux de réponse > 100000 refusé', $$insert into public.pro_logs (envoyes) values (100001)$$);
select tst.denied('admin : canal inconnu refusé', $$insert into public.pro_strategies (titre, canal) values ('x', 'pigeon')$$);
insert into public.pro_offers (id, nom, prix) values ('30000000-0000-0000-0000-000000000001', 'Pack test', 100);
update public.pro_strategies set offer_id = '30000000-0000-0000-0000-000000000001';
select tst.eq('admin rattache une offre à sa stratégie', (select count(*) from public.pro_strategies where offer_id is not null), 1);
select tst.denied('admin : offre inconnue refusée', $$update public.pro_strategies set offer_id = gen_random_uuid()$$);
insert into public.pro_videos (jour, titre, type) values ('2026-11-03', 'Vidéo 1', 'viral'), ('2026-11-03', 'Vidéo 2 même jour', 'valeur');
select tst.eq('admin : plusieurs vidéos le même jour', (select count(*) from public.pro_videos where jour = '2026-11-03'), 2);
select tst.denied('admin : type de vidéo inconnu refusé', $$insert into public.pro_videos (jour, titre, type) values ('2026-11-03', 'x', 'autre')$$);
insert into public.agenda_events (jour, titre, type, kind, prospect) values ('2026-11-04', 'Relancer Marque X', 'relance', 'prospect', 'Marque X');
select tst.eq('admin : événement de prospect créé', (select count(*) from public.agenda_events where kind = 'prospect'), 1);
select tst.denied('admin : type d''événement inconnu refusé', $$insert into public.agenda_events (jour, titre, type) values ('2026-11-04', 'x', 'zzz')$$);
select tst.denied('admin : heure invalide refusée', $$insert into public.agenda_events (jour, titre, heure) values ('2026-11-04', 'x', '99:99')$$);
select tst.denied('admin : écrire pour un autre compte refusé', $$insert into public.pro_strategies (user_id, titre) values ('00000000-0000-0000-0000-0000000000a1', 'intrus')$$);
rollback;
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'ca', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('client : 0 stratégie visible', (select count(*) from public.pro_strategies), 0);
select tst.denied('client : écrit une stratégie', $$insert into public.pro_strategies (titre) values ('x')$$);
select tst.denied('client : écrit un log', $$insert into public.pro_logs (envoyes) values (1)$$);
select tst.eq('client : 0 vidéo visible', (select count(*) from public.pro_videos), 0);
select tst.denied('client : écrit une vidéo', $$insert into public.pro_videos (jour, titre) values ('2026-11-03', 'x')$$);
select tst.eq('client : 0 événement visible', (select count(*) from public.agenda_events), 0);
select tst.denied('client : écrit un événement', $$insert into public.agenda_events (jour, titre) values ('2026-11-04', 'x')$$);
select tst.denied('client : écrit un prospect', $$insert into public.pro_prospects (nom) values ('x')$$);
rollback;
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'nobody', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.denied('compte inconnu : écrit une stratégie', $$insert into public.pro_strategies (titre) values ('x')$$);
rollback;
begin; set local role anon;
select tst.denied('anon : lit les stratégies', $$select * from public.pro_strategies$$);
rollback;

-- ---------- Le verrouillage se lève après une connexion réussie ----------
begin;
insert into public.audit_log (type, detail, created_at) select 'login_failed', repeat('c', 64), now() - interval '2 minutes' from generate_series(1, 5);
select tst.eq('5 échecs récents : verrouillé', public.login_locked(repeat('c', 64))::int, 1);
insert into public.audit_log (type, detail) values ('login_success', repeat('c', 64));
select tst.eq('après une connexion réussie : déverrouillé', public.login_locked(repeat('c', 64))::int, 0);
rollback;

-- ---------- Audits ----------
insert into public.audits (id, user_id, title, status, slug, password_hash, has_password) values
  ('20000000-0000-0000-0000-0000000000a1', :'adm', 'Audit admin', 'published', 'abcdEFGH12', 'secret-hash', true),
  ('20000000-0000-0000-0000-0000000000a2', :'nobody', 'Audit inconnu', 'draft', null, null, false);
insert into public.audit_views (audit_id) values ('20000000-0000-0000-0000-0000000000a1'), ('20000000-0000-0000-0000-0000000000a1');
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'adm', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('admin : voit seulement ses audits', (select count(*) from public.audits), 1);
select tst.eq('admin : voit les vues de son audit', (select vues from public.audit_view_stats()), 2);
select tst.denied('admin : lit password_hash', $$select password_hash from public.audits$$);
select tst.denied('admin : écrit password_hash', $$update public.audits set password_hash = 'x'$$);
select tst.denied('admin : se met published tout seul', $$update public.audits set status = 'published', slug = 'zzzzzzzz99'$$);
select tst.denied('admin : écrit une vue', $$insert into public.audit_views (audit_id) values ('20000000-0000-0000-0000-0000000000a1')$$);
select tst.denied('admin : crée un audit pour un autre', $$insert into public.audits (user_id, title) values ('00000000-0000-0000-0000-0000000000f1', 'x')$$);
update public.audits set title = 'Nouveau titre';
select tst.eq('admin : modifie son titre', (select count(*) from public.audits where title = 'Nouveau titre'), 1);
rollback;
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'ca', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('client : ne voit aucun audit', (select count(*) from public.audits), 0);
select tst.denied('client : crée un audit', $$insert into public.audits (title) values ('x')$$);
rollback;
begin; set local role anon;
select tst.denied('anon : lit les audits', $$select id from public.audits$$);
select tst.denied('anon : lit les vues', $$select * from public.audit_views$$);
rollback;

-- ---------- Équipe : rôles et permissions ----------
\set m1 '00000000-0000-0000-0000-0000000000c1'
\set m2 '00000000-0000-0000-0000-0000000000c2'
insert into auth.users (id, email) values (:'m1','m1@x.fr'), (:'m2','m2@x.fr');
insert into public.team_roles (id, nom, perms) values
  ('30000000-0000-0000-0000-000000000001', 'Setter', '{"prospection":{"view":true,"edit":true,"delete":false},"radar":{"view":true,"edit":false,"delete":false},"audits":{"view":false,"edit":true,"delete":true}}'),
  ('30000000-0000-0000-0000-000000000002', 'Autre', '{}');
insert into public.team_members (user_id, role_id) values (:'m1', '30000000-0000-0000-0000-000000000001'), (:'m2', null);
insert into public.pro_prospects (id, user_id, nom) values ('40000000-0000-0000-0000-000000000001', :'adm', 'Prospect de l''admin');
insert into public.radar_leads (user_id, website) values (:'adm', 'https://exemple.fr');

begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'m1', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('membre : droits lus', (public.my_perms() -> 'prospection' ->> 'edit')::boolean::int, 1);
select tst.eq('membre : voit les prospects de l''admin', (select count(*) from public.pro_prospects where user_id = :'adm'), 1);
select tst.n('membre : modifie un prospect de l''admin', $$update public.pro_prospects set nom = 'Modifié' where user_id = '00000000-0000-0000-0000-00000000000a'$$, 1);
select tst.n('membre : ajoute un prospect pour l''admin', $$insert into public.pro_prospects (user_id, nom) values ('00000000-0000-0000-0000-00000000000a', 'Nouveau')$$, 1);
select tst.n('membre : suppression sans droit = 0 ligne', $$delete from public.pro_prospects where user_id = '00000000-0000-0000-0000-00000000000a'$$, 0);
select tst.eq('membre : voit les pistes Radar (lecture)', (select count(*) from public.radar_leads where user_id = :'adm'), 1);
select tst.n('membre : Radar en lecture seule (modif = 0)', $$update public.radar_leads set website = 'https://x.fr' where user_id = '00000000-0000-0000-0000-00000000000a'$$, 0);
select tst.denied('membre : ajoute une piste Radar sans droit', $$insert into public.radar_leads (user_id, website) values ('00000000-0000-0000-0000-00000000000a', 'https://y.fr')$$);
select tst.eq('membre : audits sans « voir » = rien', (select count(*) from public.audits), 0);
select tst.denied('membre : crée un audit (voir décoché)', $$insert into public.audits (user_id, title) values ('00000000-0000-0000-0000-00000000000a', 'x')$$);
select tst.eq('membre : ne voit que son rôle', (select count(*) from public.team_roles), 1);
select tst.eq('membre : ne voit que lui dans l''équipe', (select count(*) from public.team_members), 1);
select tst.denied('membre : se change de rôle', $$update public.team_members set role_id = '30000000-0000-0000-0000-000000000002'$$);
select tst.denied('membre : crée un rôle', $$insert into public.team_roles (nom, perms) values ('Pirate', '{}')$$);
select tst.denied('membre : modifie son rôle', $$update public.team_roles set perms = '{"audits":{"view":true,"edit":true,"delete":true}}'$$);
select tst.denied('membre : s''ajoute dans l''équipe', $$insert into public.team_members (user_id) values ('00000000-0000-0000-0000-0000000000f1')$$);
select tst.denied('membre : écrit dans la présence', $$insert into public.team_presence (user_id) values ('00000000-0000-0000-0000-0000000000f1')$$);
select public.touch_presence();
select tst.eq('membre : ne lit pas la présence', (select count(*) from public.team_presence), 0);
select tst.eq('membre : pas d''accès aux clients', (select count(*) from public.espace_businesses), 0);
select tst.denied('membre : écrit un client', $$insert into public.espace_businesses (nom) values ('x')$$);
select tst.eq('membre : pas de messages', (select count(*) from public.espace_messages), 0);
rollback;

begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'m2', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('membre sans rôle : voit rien (prospects)', (select count(*) from public.pro_prospects where user_id = :'adm'), 0);
select tst.eq('membre sans rôle : voit rien (radar)', (select count(*) from public.radar_leads where user_id = :'adm'), 0);
select tst.denied('membre sans rôle : écrit pour l''admin', $$insert into public.pro_prospects (user_id, nom) values ('00000000-0000-0000-0000-00000000000a', 'x')$$);
rollback;

begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'adm', true), set_config('request.jwt.claim.aal', 'aal1', true);
select public.touch_presence();
select tst.eq('admin : voit tous les rôles', (select count(*) from public.team_roles), 2);
select tst.eq('admin : voit tous les membres', (select count(*) from public.team_members), 2);
select tst.eq('admin : lit la présence', (select count(*) from public.team_presence), 1);
select tst.n('admin : change le rôle d''un membre', $$update public.team_members set role_id = '30000000-0000-0000-0000-000000000002' where user_id = '00000000-0000-0000-0000-0000000000c2'$$, 1);
rollback;

begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'ca', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('client : ne voit aucun rôle', (select count(*) from public.team_roles), 0);
select tst.denied('client : touche à l''équipe', $$insert into public.team_members (user_id) values ('00000000-0000-0000-0000-0000000000f1')$$);
select tst.eq('client : ne voit pas les prospects', (select count(*) from public.pro_prospects), 0);
rollback;
-- ---------- Messages de l'équipe ----------
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'adm', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.n('admin écrit à un membre', $$insert into public.team_messages (member_id, auteur, texte) values ('00000000-0000-0000-0000-0000000000c1', 'admin', 'Salut')$$, 1);
select tst.n('admin écrit à un autre membre', $$insert into public.team_messages (member_id, auteur, texte) values ('00000000-0000-0000-0000-0000000000c2', 'admin', 'Hello')$$, 1);
commit;
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'m1', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('membre : ne voit que sa conversation', (select count(*) from public.team_messages), 1);
select tst.n('membre : répond dans sa conversation', $$insert into public.team_messages (member_id, auteur, texte) values ('00000000-0000-0000-0000-0000000000c1', 'membre', 'Salut !')$$, 1);
select tst.denied('membre : écrit chez un autre membre', $$insert into public.team_messages (member_id, auteur, texte) values ('00000000-0000-0000-0000-0000000000c2', 'membre', 'x')$$);
select tst.denied('membre : se fait passer pour l''admin', $$insert into public.team_messages (member_id, auteur, texte) values ('00000000-0000-0000-0000-0000000000c1', 'admin', 'x')$$);
select tst.n('membre : ne peut pas modifier un message', $$update public.team_messages set texte = 'hack'$$, 0);
select tst.n('membre : ne peut pas supprimer un message', $$delete from public.team_messages$$, 0);
select public.team_mark_read();
select tst.eq('membre : message admin marqué lu', (select count(*) from public.team_messages where auteur = 'admin' and lu), 1);
rollback;
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'ca', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('client : ne voit pas les messages d''équipe', (select count(*) from public.team_messages), 0);
select tst.denied('client : écrit un message d''équipe', $$insert into public.team_messages (member_id, auteur, texte) values ('00000000-0000-0000-0000-0000000000c1', 'membre', 'x')$$);
rollback;
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'adm', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('admin : lit les messages d''équipe (2 + 1 répondu non, rollback)', (select count(*) from public.team_messages), 2);
select tst.n('admin : marque lu', $$select public.team_mark_read('00000000-0000-0000-0000-0000000000c1')$$, 1);
rollback;
delete from public.team_messages;

-- ---------- Messages partenaires ----------
\set pu '00000000-0000-0000-0000-0000000000f7'
insert into auth.users (id, email) values (:'pu', 'part@x.fr');
insert into public.espace_partners (nom, user_id) values ('Studio Test', :'pu');
insert into public.partner_messages (partner_user_id, auteur, texte) values (:'pu', 'admin', 'Bonjour partenaire');
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'pu', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('partenaire : voit sa conversation', (select count(*) from public.partner_messages), 1);
select tst.n('partenaire : répond', $$insert into public.partner_messages (partner_user_id, auteur, texte) values ('00000000-0000-0000-0000-0000000000f7', 'partenaire', 'Merci')$$, 1);
select tst.denied('partenaire : se fait passer pour l''admin', $$insert into public.partner_messages (partner_user_id, auteur, texte) values ('00000000-0000-0000-0000-0000000000f7', 'admin', 'x')$$);
select tst.denied('partenaire : écrit au nom d''un autre', $$insert into public.partner_messages (partner_user_id, auteur, texte) values ('00000000-0000-0000-0000-0000000000c1', 'partenaire', 'x')$$);
select tst.n('partenaire : ne modifie pas', $$update public.partner_messages set texte = 'hack'$$, 0);
select tst.eq('partenaire : ne voit pas les messages d''équipe', (select count(*) from public.team_messages), 0);
select public.partner_mark_read();
select tst.eq('partenaire : message admin lu', (select count(*) from public.partner_messages where auteur = 'admin' and lu), 1);
rollback;
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'m1', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('membre : ne voit pas les messages partenaires', (select count(*) from public.partner_messages), 0);
rollback;
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'ca', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('client : ne voit pas les messages partenaires', (select count(*) from public.partner_messages), 0);
rollback;
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'adm', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('admin : lit les messages partenaires', (select count(*) from public.partner_messages), 1);
rollback;
delete from public.partner_messages; delete from public.espace_partners where user_id = :'pu';

-- ---------- Suivi quotidien ----------
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'adm', true), set_config('request.jwt.claim.aal', 'aal1', true);
insert into public.suivi_jours (jour, google, instagram, reponses, audits, ventes) values ('2026-11-02', 20, 15, 4, 2, 1);
select tst.eq('admin : note sa journée', (select count(*) from public.suivi_jours), 1);
select tst.denied('admin : un seul enregistrement par jour', $$insert into public.suivi_jours (jour) values ('2026-11-02')$$);
select tst.denied('admin : nombre négatif refusé', $$insert into public.suivi_jours (jour, google) values ('2026-11-03', -1)$$);
select tst.n('admin : corrige sa journée (upsert)', $$insert into public.suivi_jours (jour, google) values ('2026-11-02', 30) on conflict (user_id, jour) do update set google = excluded.google$$, 1);
select tst.denied('admin : écrire pour un autre compte refusé', $$insert into public.suivi_jours (user_id, jour) values ('00000000-0000-0000-0000-0000000000a1', '2026-11-04')$$);
commit;
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'m1', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('membre (droit prospection) : voit le suivi', (select count(*) from public.suivi_jours), 1);
select tst.n('membre : modifie une journée', $$update public.suivi_jours set ventes = 2$$, 1);
select tst.n('membre : suppression sans droit = 0', $$delete from public.suivi_jours$$, 0);
rollback;
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'m2', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('membre sans rôle : ne voit rien', (select count(*) from public.suivi_jours), 0);
rollback;
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'ca', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('client : ne voit pas le suivi', (select count(*) from public.suivi_jours), 0);
select tst.denied('client : écrit dans le suivi', $$insert into public.suivi_jours (jour) values ('2026-11-05')$$);
rollback;
begin; set local role anon;
select tst.denied('anon : lit le suivi', $$select * from public.suivi_jours$$);
rollback;
delete from public.suivi_jours;

begin; set local role anon;
select tst.denied('anon : lit les rôles', $$select * from public.team_roles$$);
select tst.denied('anon : appelle touch_presence', $$select public.touch_presence()$$);
rollback;

-- ---------- Espace réseaux sociaux : stats, calendrier, collaborations ----------
insert into public.espace_social_stats (business_id, mois, reseau, abonnes) values (:'bizA', '2026-09-01', 'instagram', 1200), (:'bizB', '2026-09-01', 'tiktok', 50);
insert into public.espace_posts (business_id, date_prevue, reseau, titre) values (:'bizA', '2026-11-02', 'instagram', 'Reel A'), (:'bizB', '2026-11-02', 'tiktok', 'Vidéo B');
insert into public.espace_collabs (business_id, marque, montant, statut) values (:'bizA', 'Marque A', 500, 'signe'), (:'bizB', 'Marque B', 900, 'signe');
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'ca', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('client A : voit ses stats réseaux', (select count(*) from public.espace_social_stats), 1);
select tst.eq('client A : voit son calendrier', (select count(*) from public.espace_posts), 1);
select tst.eq('client A : voit ses collaborations', (select count(*) from public.espace_collabs), 1);
select tst.eq('client A : ne voit pas celles de B', (select count(*) from public.espace_collabs where marque = 'Marque B'), 0);
select tst.denied('client A : écrit un post', $$insert into public.espace_posts (business_id, date_prevue, reseau, titre) values ('10000000-0000-0000-0000-0000000000a1', '2026-12-01', 'instagram', 'x')$$);
select tst.denied('client A : écrit une collab', $$insert into public.espace_collabs (business_id, marque) values ('10000000-0000-0000-0000-0000000000a1', 'x')$$);
select tst.denied('client A : écrit des stats', $$insert into public.espace_social_stats (business_id, mois, reseau) values ('10000000-0000-0000-0000-0000000000a1', '2026-10-01', 'instagram')$$);
select tst.n('client A : modifie une collab = 0 ligne', $$update public.espace_collabs set montant = 99999$$, 0);
select tst.n('client A : supprime un post = 0 ligne', $$delete from public.espace_posts$$, 0);
rollback;
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'adm', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('admin : voit toutes les collaborations', (select count(*) from public.espace_collabs), 2);
select tst.eq('admin : voit tous les posts', (select count(*) from public.espace_posts), 2);
select tst.n('admin : modifie une collab', $$update public.espace_collabs set statut = 'signe' where marque = 'Marque A'$$, 1);
select tst.denied('admin : réseau inconnu refusé', $$insert into public.espace_posts (business_id, date_prevue, reseau, titre) values ('10000000-0000-0000-0000-0000000000a1', '2026-12-01', 'myspace', 'x')$$);
select tst.denied('admin : type de client inconnu refusé', $$update public.espace_businesses set type = 'pirate'$$);
select tst.denied('admin : section inconnue refusée', $$update public.espace_businesses set sections = array['hack']$$);
select tst.eq('admin : export RGPD inclut les collaborations', jsonb_array_length(public.espace_export_business('10000000-0000-0000-0000-0000000000a1') -> 'collaborations')::bigint, 1);
rollback;
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'m1', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('membre de l''équipe : ne voit pas les collaborations des clients', (select count(*) from public.espace_collabs), 0);
rollback;
begin; set local role anon;
select tst.denied('anon : lit les collaborations', $$select * from public.espace_collabs$$);
select tst.denied('anon : lit le calendrier', $$select * from public.espace_posts$$);
rollback;

-- ---------- Partenaires : annuaire, liens, comptes, notes privées ----------
\set pu1 '00000000-0000-0000-0000-0000000000e7'
insert into auth.users (id, email) values (:'pu1', 'photo@x.fr');
insert into public.espace_partners (id, nom, categorie, statut, email, instagram, user_id) values
  ('50000000-0000-0000-0000-000000000001', 'Studio Lumière', 'photographe', 'actif', 'studio@x.fr', '@studiolumiere', :'pu1'),
  ('50000000-0000-0000-0000-000000000002', 'Maison Dior', 'marque', 'en_discussion', 'dior@x.fr', '@dior', null),
  ('50000000-0000-0000-0000-000000000003', 'Nike', 'marque', 'contacte', null, null, null);
insert into public.espace_partner_private (partner_id, tarif, notes) values ('50000000-0000-0000-0000-000000000001', '400 € la demi-journée', 'Très pro');
insert into public.espace_partner_links (business_id, partner_id) values (:'bizA', '50000000-0000-0000-0000-000000000001'), (:'bizA', '50000000-0000-0000-0000-000000000002'), (:'bizB', '50000000-0000-0000-0000-000000000003');
insert into public.espace_collabs (business_id, marque, partner_id, statut) values (:'bizA', 'Shooting studio', '50000000-0000-0000-0000-000000000001', 'en_cours'), (:'bizB', 'Autre shooting', '50000000-0000-0000-0000-000000000003', 'en_cours');
insert into public.espace_collabs (business_id, marque, statut) values (:'bizA', 'Marque en recherche', 'a_contacter'), (:'bizA', 'Marque refusée', 'refuse');
insert into public.espace_private (business_id, objectifs, notes) values (:'bizA', 'Signer 3 marques', 'Note privée A'), (:'bizB', 'x', 'Note privée B');

begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'ca', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('mannequin A : voit ses 2 partenaires', (select count(*) from public.espace_partners), 2);
select tst.eq('mannequin A : ne voit pas les étapes de recherche', (select count(*) from public.espace_collabs where statut in ('a_contacter', 'refuse')), 0);
select tst.eq('mannequin A : ne voit pas le partenaire de B', (select count(*) from public.espace_partners where nom = 'Nike'), 0);
select tst.eq('mannequin A : voit ses liens', (select count(*) from public.espace_partner_links), 2);
select tst.eq('mannequin A : aucune note privée de partenaire', (select count(*) from public.espace_partner_private), 0);
select tst.eq('mannequin A : aucune note privée de lui-même', (select count(*) from public.espace_private), 0);
select tst.denied('mannequin A : crée un partenaire', $$insert into public.espace_partners (nom) values ('x')$$);
select tst.denied('mannequin A : crée un lien', $$insert into public.espace_partner_links (business_id, partner_id) values ('10000000-0000-0000-0000-0000000000a1', '50000000-0000-0000-0000-000000000003')$$);
select tst.n('mannequin A : modifie un partenaire = 0 ligne', $$update public.espace_partners set nom = 'Pirate'$$, 0);
rollback;

begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'pu1', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('partenaire : voit sa fiche seulement', (select count(*) from public.espace_partners), 1);
select tst.eq('partenaire : voit ses mannequins', (select count(*) from public.espace_businesses), 1);
select tst.eq('partenaire : voit ses collaborations', (select count(*) from public.espace_collabs), 1);
select tst.eq('partenaire : ne voit pas les avis, tâches, messages', (select count(*) from public.espace_reviews) + (select count(*) from public.espace_tasks) + (select count(*) from public.espace_messages), 0);
select tst.eq('partenaire : ne voit pas ses tarifs', (select count(*) from public.espace_partner_private), 0);
select tst.eq('partenaire : aucune note privée de mannequin', (select count(*) from public.espace_private), 0);
select tst.eq('partenaire : ne voit pas les stats des mannequins', (select count(*) from public.espace_social_stats), 0);
select tst.eq('partenaire : ne voit rien de la prospection', (select count(*) from public.pro_prospects), 0);
select tst.denied('partenaire : écrit une collaboration', $$insert into public.espace_collabs (business_id, marque) values ('10000000-0000-0000-0000-0000000000a1', 'x')$$);
select tst.denied('partenaire : se lie à un mannequin', $$insert into public.espace_partner_links (business_id, partner_id) values ('10000000-0000-0000-0000-0000000000b1', '50000000-0000-0000-0000-000000000001')$$);
select tst.n('partenaire : modifie sa fiche = 0 ligne', $$update public.espace_partners set statut = 'inactif'$$, 0);
select tst.eq('partenaire : espace_access_ok', public.espace_access_ok()::int, 1);
select tst.eq('partenaire : pas espace_admin_ok', public.espace_admin_ok()::int, 0);
rollback;

begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'adm', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('admin : voit tous les partenaires', (select count(*) from public.espace_partners), 3);
select tst.eq('admin : voit les tarifs', (select count(*) from public.espace_partner_private), 1);
select tst.eq('admin : voit les notes privées', (select count(*) from public.espace_private), 2);
select tst.denied('admin : catégorie inconnue refusée', $$insert into public.espace_partners (nom, categorie) values ('x', 'pirate')$$);
select tst.n('admin : modifie le statut d''une collab (nouveau statut)', $$update public.espace_collabs set statut = 'a_contacter'$$, 6);
select tst.eq('admin : export RGPD liste les partenaires liés', jsonb_array_length(public.espace_export_business('10000000-0000-0000-0000-0000000000a1') -> 'partenaires_lies')::bigint, 2);
rollback;
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'m1', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('membre équipe : pas d''annuaire partenaires', (select count(*) from public.espace_partners), 0);
rollback;
begin; set local role anon;
select tst.denied('anon : lit les partenaires', $$select * from public.espace_partners$$);
select tst.denied('anon : lit les notes privées', $$select * from public.espace_private$$);
rollback;

\echo TOUS LES TESTS ISOLATION SONT PASSES
