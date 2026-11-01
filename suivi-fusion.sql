-- ============================================================================
-- Zenoa Agency — range tes anciens chiffres « Sans stratégie » dans « Insta Entreprise »
-- (SQL Editor > New query > coller > Run). Les chiffres sont DÉPLACÉS, rien n'est perdu.
-- Il faut qu'une stratégie nommée « Insta Entreprise » existe (Gérer mes stratégies).
-- ============================================================================
do $$
declare v_admin uuid; v_from uuid; v_to uuid; n integer;
begin
  select id into v_admin from public.espace_profiles where role = 'admin' order by created_at limit 1;
  if v_admin is null then raise exception 'Aucun compte administrateur trouvé (espace_profiles).'; end if;
  select id into v_from from public.suivi_strategies where user_id = v_admin and systeme limit 1;
  select id into v_to from public.suivi_strategies where user_id = v_admin and not systeme and lower(btrim(nom)) = 'insta entreprise' limit 1;
  if v_from is null then raise notice 'Rien à déplacer : pas de ligne « Sans stratégie ».'; return; end if;
  if v_to is null then raise exception 'Aucune stratégie nommée « Insta Entreprise » : crée-la (ou renomme-la) dans « Gérer mes stratégies », puis relance.'; end if;

  -- un même jour dans les deux : on additionne ; sinon on déplace.
  insert into public.suivi_lignes (user_id, jour, strategie_id, dm, reponses, audits, offres, ventes)
    select user_id, jour, v_to, dm, reponses, audits, offres, ventes from public.suivi_lignes where strategie_id = v_from
    on conflict (user_id, jour, strategie_id) do update set
      dm = least(public.suivi_lignes.dm + excluded.dm, 100000),
      reponses = least(public.suivi_lignes.reponses + excluded.reponses, 100000),
      audits = least(public.suivi_lignes.audits + excluded.audits, 100000),
      offres = least(public.suivi_lignes.offres + excluded.offres, 100000),
      ventes = least(public.suivi_lignes.ventes + excluded.ventes, 100000),
      updated_at = now();
  get diagnostics n = row_count;
  delete from public.suivi_lignes where strategie_id = v_from;
  raise notice '% ligne(s) déplacée(s) vers Insta Entreprise.', n;
end $$;
