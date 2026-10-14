# Zenoa Radar

SaaS de prospection : recherche d'entreprises locales sans site web ou
avec un site à moderniser (via OpenStreetMap), mini CRM, premier
contact, maquettes de sites vitrine à partager.

Construit uniquement avec des services gratuits : Supabase (plan
gratuit) et Vercel (plan gratuit). Aucune clé API payante.

## Démarrer en local

```bash
cp .env.example .env   # déjà rempli avec les identifiants du projet Supabase
npm install
npm run dev
```

## Déploiement (Vercel)

Projet [Vite](https://vite.dev/) standard, détecté et buildé automatiquement
par Vercel (`npm run build`, dossier de sortie `dist/`). **Important** :
définir `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (voir
`.env.example`) dans Vercel → Project Settings → Environment Variables,
sinon le build de production n'a pas accès à Supabase.

## Base de données (Supabase)

Chaque étape ajoute son propre fichier `.sql` à la racine, à coller dans
Supabase Dashboard → SQL Editor → Run (idempotent, sans risque de le
réexécuter) :

- `plans-and-users.sql` — table `plans` (gratuit/pro + quotas), table
  `user_plans` (plan de chaque utilisateur, créé automatiquement à
  l'inscription), RLS sur les deux.

## Structure

```
index.html              #screen-auth (connexion/inscription) + #app (sidebar/topbar/contenu) + #screen-demo (page publique de maquette)
src/
  main.js                démarrage, navigation entre vues, déconnexion
  supabase.js              client Supabase (lit les variables d'env VITE_*)
  auth.js                    écran de connexion/inscription
  confirm-dialog.js            modale de confirmation réutilisable
  views/
    dashboard.js               Tableau de bord (étape 6)
    recherche.js                Recherche OpenStreetMap (étape 2)
    prospects.js                 Mini CRM (étape 3 + 4)
    maquettes.js                  Générateur de maquettes (étape 5)
  styles/                 design system (tokens, base, composants, mise en page)
public/                  logo, favicons, icônes PWA, manifest
```

## Design system

Voir `src/styles/` — variables CSS dans `tokens.css`, composants
réutilisables (`.btn`, `.card`, `.badge-pill`, `.status-pill`, `.switch`,
modale) dans `components.css`, mise en page sidebar/topbar dans
`layout.css`.

## Avancement

- [x] Étape 1 — Comptes utilisateurs (email + mot de passe, RLS, plans/quotas)
- [ ] Étape 2 — Recherche d'entreprises (OpenStreetMap)
- [ ] Étape 3 — Mini CRM prospects
- [ ] Étape 4 — Premier contact (mailto + copier message)
- [ ] Étape 5 — Maquettes de sites vitrine
- [ ] Étape 6 — Tableau de bord
