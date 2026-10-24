# Zenoa Agency

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
- `search-and-prospects.sql` — table `radar_prospects` (mes prospects,
  schéma complet CRM prêt pour l'étape 3), `search_history` (suivi des
  quotas), `business_search_cache` et `city_geocode_cache` (cache
  interne, aucun accès client).
- `message-templates.sql` — table `message_templates` (modèles de
  message avec variables `{nom}`/`{ville}`/`{categorie}`), un modèle
  par défaut créé automatiquement à l'inscription.
- `demo-sites.sql` — colonnes `lat`/`lon` sur `radar_prospects`, table
  `demo_sites` (maquettes, lecture publique pour la page `/demo/:slug`,
  écriture réservée au propriétaire).
- `user-profiles.sql` — table `user_profiles` (pseudo + photo de
  profil), bucket de stockage `avatars` (lecture publique, écriture
  limitée à ses propres fichiers).
- `delete-account.sql` — fonction `delete_my_account()` (supprime le
  compte et toutes ses données, utilisée par Paramètres → Zone
  dangereuse).

## Edge Functions (Supabase)

À déployer via la [CLI Supabase](https://supabase.com/docs/guides/functions/deploy) :

```bash
npm install -g supabase
supabase login
supabase link --project-ref mfdqxzccmzumxiichdqw
supabase functions deploy osm-search
```

- `osm-search` — recherche d'entreprises (Nominatim + Overpass),
  complète les emails manquants en lisant le site web, calcule la
  qualité du site. Gratuite, aucune clé API requise.

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
    settings.js                    Paramètres : pseudo + photo de profil
  styles/                 design system (tokens, base, composants, mise en page)
public/                  logo, favicons, icônes PWA, manifest
```

## Design system

Voir `src/styles/` — variables CSS dans `tokens.css`, composants
réutilisables (`.btn`, `.card`, `.badge-pill`, `.status-pill`, `.switch`,
modale) dans `components.css`, mise en page sidebar/topbar dans
`layout.css`.

## PWA

`public/sw.js` + `public/manifest.webmanifest` rendent le site
installable comme une application sur mobile et desktop (stratégie
"réseau d'abord", ne met en cache que la coquille de l'appli —
jamais les données).

## Avancement

- [x] Étape 1 — Comptes utilisateurs (email + mot de passe, RLS, plans/quotas)
- [x] Étape 2 — Recherche d'entreprises (OpenStreetMap)
- [x] Étape 3 — Mini CRM prospects (aucune nouvelle table : utilise radar_prospects posée à l'étape 2)
- [x] Étape 4 — Premier contact (mailto + copier message)
- [x] Étape 5 — Maquettes de sites vitrine
- [x] Étape 6 — Tableau de bord

## Espace clients (suivi de visibilité Google)

Espace pour les clients de l'agence : chaque commerce voit sa note, ses avis, ses chiffres Google, ses tâches
et écrit à l'admin ; l'admin saisit les données depuis la page « Clients ». Même site, même connexion que Radar.

Mise en place (Supabase) :
1. `espace.sql` : tables `espace_*` + règles de sécurité (RLS) + désignation de l'admin (remplacer l'email dans le fichier).
2. `espace-demo.sql` (facultatif) : 2 commerces d'exemple (barbier, plombier). Suppression : `delete from public.espace_businesses where is_example;`
3. Fonction Edge `espace-admin` (`supabase/functions/espace-admin/index.ts`) : création des comptes clients. À coller dans
   Supabase > Edge Functions > Via Editor, nom exact `espace-admin`.
4. `espace-metriques.sql` : choix des chiffres à suivre par client (ex. pas d'« Itinéraires » pour un électricien).
5. `espace-rappels.sql` : date de la prochaine saisie des chiffres par client (rappel en couleur vive à 3 jours ou moins).
6. Facultatif : la ligne `alter publication supabase_realtime ...` en bas de `espace.sql` pour des messages instantanés.

Rôles : `admin` (toi : Clients, Aperçu client, Messages + Radar/Ressources), `client` (Mon espace, Messages),
`radar` (utilisateur Radar sans profil : l'appli comme avant). Les droits sont dans la base, pas dans le navigateur.

Logo : remplace `public/sidebar-logo.png` (carré, fond noir) et `public/zenoa-icon.png` (fond transparent).
Couleurs et thème : `src/styles/tokens.css`.

## Sécurité et RGPD

Voir [`docs/SECURITE.md`](docs/SECURITE.md) (protections, réglages Supabase/Vercel, risques restants, checklist avant de vraies données), ainsi que :
- `securite.sql` — à coller dans Supabase **après** `espace.sql` ;
- `docs/RGPD-registre-traitements.md`, `docs/RGPD-sous-traitants.md`, `docs/PROCEDURE-violation-donnees.md`, `docs/SAUVEGARDES.md` ;
- pages légales à compléter : `public/legal/*.html` ;
- tests : `npm test` (règles de mot de passe, fonction `espace-admin`, isolation des données sur PostgreSQL local).

## Module Prospection

Page **Calendrier** (admin uniquement) : calendrier de création de contenu (vidéos du mois, plusieurs par jour, 3 types, scripts, avancement, saisie en lot).

Page **Prospection** (admin uniquement) : tableau de bord (chiffres clés, entonnoir, objectif, évolution, calendrier de chaleur, classement), stratégies (cartes, Kanban, détail avec scripts A/B), pipeline des prospects, scripts et packs d'offre, revue de la semaine, et bouton « + » de saisie rapide.

Installation : coller **`prospection.sql`** dans Supabase (SQL Editor > Run) **après** `espace.sql` et `securite.sql`. Les données sont rattachées à ton compte et réservées à l'admin (voir `tests/sql/isolation.sql`).

## Radar : cibles et critères

- **Quoi** (dans l'ordre) : coiffeurs/barbiers, restaurants/snacks/pizzerias, artisans (électriciens, plombiers, chauffagistes).
- **Filtrés automatiquement** : indépendants (pas de chaînes, pas plus de 10 employés), site absent ou ancien, e-mail trouvé (OpenStreetMap ou site du commerce). Fonction `supabase/functions/radar-daily` à redéployer après chaque mise à jour.
- **À vérifier à la main** depuis la fiche Google (Google ne les donne pas gratuitement) : avis, note, photos, description, réponses, dernier avis. `radar-qualification.sql` ajoute les champs ; le Radar affiche « ✓ Qualifié » ou « ✗ Hors critères ».

## Module Audits

Menu **Livrables > Audits** : liste (recherche, filtres statut / client), éditeur à blocs (titre, texte riche, image, galerie, capture annotée, tableau, score, graphique, recommandations, vidéo Loom/YouTube, citation, séparateur, bouton), plusieurs pages avec sommaire automatique, sauvegarde automatique, aperçu, modèles (SEO, publicité, site, réseaux, vierge + modèles perso).

Installation (une seule fois) :
1. Supabase > SQL Editor : coller `audits.sql` > Run (tables `audits` et `audit_views`, droits par colonne).
2. Supabase > Edge Functions > nouvelle fonction **`audit-public`** : coller `supabase/functions/audit-public/index.ts` > Deploy.

Publication : lien privé du type `/a/xK9f2mQpZr7T` (12 caractères aléatoires), page publique sans connexion, mot de passe (haché PBKDF2) et date d'expiration facultatifs, dépublication (« Audit indisponible »), `noindex`. Le lien montre toujours la dernière version **publiée** (bouton « Republier » après modification). Vues comptées côté serveur (tes propres visites connectées ne comptent pas). Images dans le bucket privé existant `user-resources` (dossier `<ton id>/audits/…`), servies par liens signés d'1 h.
