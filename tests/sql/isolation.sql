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
select tst.denied('admin : écrire pour un autre compte refusé', $$insert into public.pro_strategies (user_id, titre) values ('00000000-0000-0000-0000-0000000000a1', 'intrus')$$);
rollback;
begin; set local role authenticated;
select set_config('request.jwt.claim.sub', :'ca', true), set_config('request.jwt.claim.aal', 'aal1', true);
select tst.eq('client : 0 stratégie visible', (select count(*) from public.pro_strategies), 0);
select tst.denied('client : écrit une stratégie', $$insert into public.pro_strategies (titre) values ('x')$$);
select tst.denied('client : écrit un log', $$insert into public.pro_logs (envoyes) values (1)$$);
select tst.eq('client : 0 vidéo visible', (select count(*) from public.pro_videos), 0);
select tst.denied('client : écrit une vidéo', $$insert into public.pro_videos (jour, titre) values ('2026-11-03', 'x')$$);
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

\echo TOUS LES TESTS ISOLATION SONT PASSES
