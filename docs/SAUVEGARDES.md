# Sauvegardes et restauration

Le plan gratuit Supabase **ne fait pas de sauvegarde automatique** : sans action de ta part, une erreur ou une suppression est définitive. Le plan Pro ajoute des sauvegardes quotidiennes (7 jours).

## Sauvegarde manuelle (à faire chaque semaine, 5 minutes)
Supabase → **Database → Backups** (si disponible) ou, en ligne de commande avec la chaîne de connexion *Session pooler* (Project Settings → Database) :

```bash
pg_dump "postgresql://postgres.xxxx:MOT_DE_PASSE@aws-0-REGION.pooler.supabase.com:5432/postgres" \
  --schema=public --no-owner --no-privileges -Fc -f zenoa-$(date +%F).dump
```
Garde le fichier **chiffré** (gestionnaire de mots de passe ou disque chiffré), hors du dépôt Git. Les fichiers (bucket `user-resources`) sont à télécharger depuis Storage si besoin.

Astuce sans ligne de commande : *Table Editor → … → Export to CSV* pour les tables `espace_*` et `crm_*`.

## Test de restauration (à faire AU MOINS une fois avant le lancement, puis chaque trimestre)
1. Créer un **projet Supabase de test** (gratuit).
2. Coller `espace.sql`, `securite.sql` et les autres fichiers `.sql` du dépôt (schéma).
3. Restaurer les données : `pg_restore --data-only --no-owner -d "<connexion du projet de test>" zenoa-AAAA-MM-JJ.dump`.
4. Se connecter à une copie de l'appli pointant sur ce projet et vérifier : un client voit ses avis, l'admin voit tous les clients.
5. Noter la date et le résultat ici : `[date — OK / problème]`. Supprimer le projet de test (il contient de vraies données).

## Durées de conservation des sauvegardes
Garde les sauvegardes **90 jours maximum** (puis supprime-les) : une personne qui exerce son droit à l'effacement doit disparaître des sauvegardes dans ce délai raisonnable ; indique-le dans la politique de confidentialité.
