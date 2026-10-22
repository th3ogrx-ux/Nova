# Zenoa Espace

Suivi de visibilité Google pour des commerces locaux : un espace **admin** (toi) et un espace **client** par commerce.
Next.js (App Router) + TypeScript + Tailwind · Supabase (base + connexion) · Recharts · qrcode.

> Ce dossier est **indépendant** du site Zenoa Radar (Vite) qui est à la racine du dépôt.
> Sur Vercel, crée un **nouveau projet** et mets « Root Directory » = `zenoa-espace`.

## Mise en route (à faire une seule fois)

1. **Créer le projet Supabase** (supabase.com > New project, gratuit).
2. **Désactiver les inscriptions libres** : Supabase > Authentication > Sign In / Providers > désactive **« Allow new users to sign up »**.
   (Même si c'était activé, un compte sans profil n'a accès à rien — mais mieux vaut fermer la porte.)
3. **Créer les tables et les règles de sécurité** : Supabase > SQL Editor > New query > colle tout le contenu de
   `supabase/migrations/0001_init.sql` > Run.
4. **Remplir les clés** : copie `.env.example` en `.env.local`, puis remplis les 3 valeurs
   (Supabase > Project Settings > API : « Project URL », clé « anon/publishable », clé « service_role »).
5. **Installer et lancer** :
   ```
   cd zenoa-espace
   npm install
   npm run create-admin -- ton@email.fr "un-mot-de-passe-solide"
   npm run dev
   ```
   Ouvre http://localhost:3000 et connecte-toi.

## Sécurité en bref
- Aucune page sans connexion (middleware) ; le rôle est lu dans la base, pas dans le navigateur.
- Les règles RLS (`0001_init.sql`) décident de tout : un client ne lit que SON commerce, n'écrit que des messages.
- La clé `service_role` n'est lue que par du code serveur (`lib/supabase/admin.ts` est marqué `server-only`).
