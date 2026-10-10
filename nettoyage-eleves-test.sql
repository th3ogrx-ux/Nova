-- ============================================================
-- NOVA / ZENOA — Nettoyage : supprime tous les élèves SAUF celui dont
-- le pseudo est "Test" (comparaison insensible à la casse et aux
-- espaces superflus, pour couvrir "Test", "test", " Test ", etc.).
--
-- /!\ DESTRUCTEUR ET IRRÉVERSIBLE : supprime le profil ET le compte
-- d'authentification de chaque élève concerné (même logique que le
-- bouton "Supprimer le compte" de la fiche élève), ce qui révoque
-- immédiatement leur accès. Leurs dépôts de projet, leur progression
-- et leurs notes partent avec eux (cascade via les clés étrangères).
--
-- Avant de lancer : vérifie la liste des pseudos qui seront supprimés
-- avec la requête de prévisualisation ci-dessous. Lance ensuite le
-- bloc "do $$ ... $$" seulement si cette liste est correcte.
--
-- Version 2 : corrige une erreur rencontrée en pratique —
-- "update or delete on table profiles violates foreign key constraint
-- radar_leads_status_set_by_fkey" — certains comptes de test avaient
-- aussi servi à trier des prospects dans Zenoa Radar, qui référence
-- profiles.id sans suppression en cascade. On vide ce lien (et un
-- autre cas similaire, admin_links.created_by) avant de supprimer,
-- et chaque suppression est protégée individuellement : si une
-- contrainte imprévue bloque un élève, les autres sont quand même
-- supprimés et l'élève bloqué est juste signalé (NOTICE) plutôt que
-- de faire échouer tout le script.
-- ============================================================

-- ----- 1) Prévisualisation (ne supprime rien) -----
select id, pseudo, email, created_at
from public.profiles
where role = 'membre' and trim(lower(pseudo)) <> 'test'
order by created_at;

-- ----- 2) Suppression (irréversible) -----
-- Ne colle ce bloc qu'après avoir vérifié la liste ci-dessus.
do $$
declare
  r record;
begin
  for r in (
    select id from public.profiles
    where role = 'membre' and trim(lower(pseudo)) <> 'test'
  ) loop
    begin
      -- Détache les références qui empêcheraient la suppression (pas
      -- de "on delete cascade"/"set null" sur ces colonnes-là) : sans
      -- effet si l'élève n'a jamais servi à ça, ce qui est le cas
      -- normal.
      update public.radar_leads set status_set_by = null where status_set_by = r.id;
      update public.admin_links set created_by = null where created_by = r.id;

      delete from public.profiles where id = r.id;
      delete from auth.users where id = r.id;
    exception when others then
      raise notice 'Élève % non supprimé (%) : %', r.id, SQLERRM, 'vérifie manuellement les tables qui le référencent encore';
    end;
  end loop;
end $$;
