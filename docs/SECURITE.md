# Sécurité — guide, réglages et checklist

Ce document résume les protections en place, les réglages à faire à la main dans Supabase/Vercel, les risques restants et ce qui demande un humain.

## 1. Ce qui est en place (dans le code)

| Sujet | Protection | Où |
|---|---|---|
| Accès sur invitation | Un compte sans profil ne lit ni n'écrit rien (politique restrictive sur toutes les tables) ; l'inscription est cachée dans l'appli | `securite.sql`, `src/auth.js` |
| Double authentification | **Facultative** (Paramètres, pour admin et clients) : une fois activée, le code est demandé à la connexion. Non exigée par la base | `src/mfa.js` |
| Isolation des clients | RLS sur toutes les tables ; un client ne voit que son commerce ; il ne peut écrire que ses messages | `espace.sql`, `tests/sql/` |
| Mots de passe | 12 caractères min., refus des mots courants et de ceux déjà volés (Have I Been Pwned, par préfixe SHA-1 : le mot de passe ne quitte jamais le navigateur) | `src/password-policy.js` |
| Connexions | Échecs comptés par empreinte d'e-mail ; blocage 15 min après 5 échecs ; message d'erreur générique | `src/auth.js`, `securite.sql` |
| Journal & alertes | Table `audit_log` (admin seulement) ; bandeau d'alerte si ≥10 échecs/heure ou ≥5 accès refusés/24 h ; ni mot de passe ni e-mail ni IP | `src/security-log.js` |
| En-têtes | CSP stricte (scripts du site uniquement), HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, COOP | `vercel.json` |
| XSS | Tout texte affiché est échappé ; liens limités à `http(s)` (jamais `javascript:`) côté appli ET base | `src/views/*`, `securite.sql` |
| Fonctions Edge | Authentification + rôle admin vérifiés ; erreurs génériques (détails dans les logs privés) ; CORS limitable à ton domaine | `supabase/functions/` |
| Secrets | Aucun secret dans le dépôt ; `.env` ignoré ; `.env.example` sans valeurs ; clé `service_role` uniquement dans Supabase | `.gitignore` |
| Dépendances | `npm audit` : 0 faille ; `package-lock.json` versionné | `package.json` |
| RGPD | Export JSON d'un client, suppression complète, purge automatique, pages légales, polices hébergées (aucune requête vers Google) | `securite.sql`, `public/legal/` |

## 2. Réglages à faire dans les tableaux de bord (je ne peux pas les faire depuis le code)

### Supabase → Authentication
1. **Sign In / Providers → Email** : décocher **« Allow new users to sign up »** (inscription sur invitation seulement). Garder « Confirm email » activé.
2. **Password** : longueur minimale **12** ; si disponible (plan Pro) activer **« Prevent use of leaked passwords »**. Sans le plan Pro, la vérification des fuites est faite par l'appli.
3. **Multi-Factor** : vérifier que **TOTP** est activé (c'est le cas par défaut).
4. **Sessions** : définir une durée maximale (ex. *Time-box user sessions* = 7 jours, *Inactivity timeout* = 24 h) si l'option est proposée par ton plan.
5. **Rate Limits** : laisser les valeurs par défaut ou les baisser (connexions par IP/heure). C'est la vraie limite côté serveur.
6. **URL Configuration** : *Site URL* = ton domaine Vercel ; *Redirect URLs* = uniquement ce domaine (évite les redirections ouvertes).
7. **Email templates** : le lien de réinitialisation est à usage unique et expire (1 h par défaut — ne pas l'allonger). Il n'y a pas de « mot de passe oublié » dans l'appli : c'est l'admin qui régénère un mot de passe temporaire.

### Supabase → Project Settings
8. **General** : noter la **région** du projet (idéalement UE : Frankfurt, Paris…) et la reporter dans `public/legal/*.html`. Impossible à changer sans recréer le projet.
9. **Edge Functions → Secrets** : ajouter `ALLOWED_ORIGINS` = `https://TON-DOMAINE.vercel.app` (limite le CORS), puis redéployer `espace-admin` et `radar-daily` (copier-coller des fichiers du dépôt).
10. **Edge Functions** : si `osm-search` est déployée, la supprimer (inutilisée par l'appli).
11. **Backups** : voir `docs/SAUVEGARDES.md` (plan gratuit : pas de sauvegarde automatique → export manuel planifié).
12. **API → Exposed schemas** : ne laisser que `public`.

### Vercel
13. **Environment Variables** : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` pour *Production* ; un autre projet Supabase (clés différentes) pour *Preview/Development*. La clé `anon` est publique par conception ; la clé `service_role` ne doit **jamais** y figurer.
14. **Domains** : HTTPS est forcé automatiquement ; HSTS est envoyé par `vercel.json`.
15. Activer **Deployment Protection** sur les déploiements *Preview*.

### GitHub
16. Settings → Code security : activer **Dependabot alerts** et **Secret scanning**.

## 3. Ordre d'installation du durcissement
1. Déployer le nouveau code (push sur `main`).
2. Coller **`securite.sql`** dans Supabase → SQL Editor → Run (relançable sans risque).
3. Redéployer les fonctions Edge, ajouter le secret `ALLOWED_ORIGINS`.
4. Faire les réglages du chapitre 2.
5. Lancer les tests : `npm test` (voir ci-dessous).

La double authentification est facultative. Conseillée pour le compte admin dès que tu as de vraies données clients (Paramètres → Double authentification).

## 4. Tests automatiques
`npm test` lance :
- `tests/unit/` — règles de mot de passe, vérification des fuites ;
- `tests/functions/` — fonction `espace-admin` (droits, journal) ;
- `tests/sql/` — **isolation des données** sur une base PostgreSQL locale jetable : un client ne lit ni n'écrit chez un autre, ne peut pas se donner le rôle admin, un compte sans profil et un admin sans 2FA n'ont aucun accès, le journal est protégé.

Pour `test:sql`, il faut un PostgreSQL local : `PGHOST=… PGPORT=… PGUSER=postgres npm run test:sql`.

## 5. Risques restants (à connaître)
- **Session dans le navigateur (localStorage)**, pas dans un cookie HttpOnly : une faille XSS pourrait la voler. La CSP stricte et l'échappement réduisent fortement ce risque. Pas de cookies donc pas de risque CSRF classique : chaque requête porte un jeton `Authorization`.
- **Blocage après échecs = garde-fou de l'appli** : un attaquant qui appelle directement l'API Supabase n'est limité que par les *Rate Limits* de Supabase (réglage 5 ci-dessus).
- **`must_change_password`** est un confort d'affichage (modifiable par l'utilisateur), pas une barrière.
- **Pas de scan antivirus** des PDF téléversés (bucket privé, dossier par utilisateur, types et taille limités, lus dans pdf.js sans exécution de script).
- **Pas d'alerte e-mail** (aucun service payant) : les alertes sont dans l'appli (bandeau + journal). Consulte-les régulièrement.
- **Suppression en fin de contrat** : manuelle (bouton « Supprimer ce client »). Les messages (24 mois) et le journal (12 mois) sont purgés automatiquement si `pg_cron` est disponible.
- **Plan gratuit Supabase** : pas de sauvegardes automatiques, projet mis en pause après 7 jours d'inactivité, pas de SLA.
- **Dépendances tierces** utilisées par l'admin : `api.microlink.io` (aperçu de lien), YouTube/OpenStreetMap (incrustations). Aucune donnée client n'y est envoyée.

## 6. Checklist avant de saisir de vraies données de clients
- [ ] (Conseillé) 2FA activée sur le compte admin
- [ ] `securite.sql` exécuté sans erreur ; `select tablename from pg_tables where schemaname='public' and not rowsecurity;` → 0 ligne
- [ ] « Allow new users to sign up » **désactivé** ; liste `auth.users` relue (aucun compte inconnu)
- [ ] Mot de passe admin ≥ 12 caractères, unique, dans un gestionnaire de mots de passe
- [ ] Fonctions Edge redéployées ; `ALLOWED_ORIGINS` défini ; `osm-search` supprimée
- [ ] Région Supabase notée ; pages `public/legal/*.html` complétées et **relues par un juriste**
- [ ] Contrat / DPA (accord de sous-traitance, art. 28 RGPD) signé avec chaque client dont tu traites les avis
- [ ] Registre des traitements rempli (`docs/RGPD-registre-traitements.md`)
- [ ] Procédure de sauvegarde **testée** (restauration dans un projet de test)
- [ ] Dependabot + secret scanning activés sur GitHub
- [ ] `npm test` vert ; `npm audit` à 0
- [ ] Test d'intrusion réalisé (voir ci-dessous)

## 7. Ce qui nécessite un humain
- **Un juriste / avocat** : relire et valider mentions légales, politique de confidentialité, CGU, contrat de sous-traitance (DPA), registre. Les textes fournis sont des *modèles*, pas un avis juridique.
- **Un test d'intrusion** par un professionnel (ou un programme de bug bounty) avant d'héberger beaucoup de données ou des clients sensibles. Mes tests couvrent l'isolation des données et les droits, pas l'ensemble des attaques réelles.
- **Toi** : les réglages du tableau de bord (chap. 2), la décision d'un plan Supabase payant (sauvegardes quotidiennes, mots de passe fuités, SLA), le choix de la région UE, la désignation éventuelle d'un DPO (non obligatoire à ton échelle).
