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
    delete from public.profiles where id = r.id;
    delete from auth.users where id = r.id;
  end loop;
end $$;
