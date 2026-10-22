# Registre des traitements (modèle — art. 30 RGPD)

> Modèle à compléter. Deux registres sont à tenir : en tant que **responsable de traitement** (tes propres données : comptes, prospection) et en tant que **sous-traitant** (avis et chiffres de tes clients). À faire relire par un juriste.

**Responsable / sous-traitant :** [NOM, ADRESSE, E-MAIL] — Délégué à la protection des données : non désigné (non obligatoire à cette échelle).

## A. Zenoa agit comme sous-traitant (données des entreprises clientes)

| Traitement | Finalité | Personnes concernées | Données | Destinataires | Durée | Sécurité |
|---|---|---|---|---|---|---|
| Espace client : suivi des avis | Montrer au client ses avis et sa note | Auteurs d'avis (clients du client) | Prénom ou pseudo, note, texte, date | Le client, Zenoa | Contrat + [12 mois] | RLS, HTTPS, journal |
| Espace client : chiffres | Suivi des vues, appels, itinéraires, etc. | Aucune personne identifiée | Chiffres agrégés par mois | Le client, Zenoa | Contrat + [12 mois] | idem |
| Messagerie | Échanges client ↔ Zenoa | Contact du client | Nom du commerce, contenu des messages | Client, Zenoa | 24 mois (purge auto) | idem |
| Comptes de connexion | Authentification | Contact du client | E-mail, mot de passe (haché), date de dernière connexion | Zenoa, Supabase | Contrat | Hachage par Supabase Auth, 2FA proposée |

## B. Zenoa agit comme responsable de traitement

| Traitement | Finalité | Personnes | Données | Base légale | Durée | Notes |
|---|---|---|---|---|---|---|
| Prospection B2B (Radar / CRM) | Trouver et suivre des entreprises à démarcher | Dirigeants/entreprises prospectés | Nom du commerce, adresse, téléphone et e-mail professionnels, site, notes | Intérêt légitime (prospection B2B, art. L34-5 CPCE : information + droit d'opposition) | [3 ans après le dernier contact] | Données issues de sources publiques (OpenStreetMap, sites web). Prévoir une mention d'information dans les premiers contacts. |
| Journal de sécurité | Détecter les abus | Utilisateurs | Type d'événement, date, identifiant de compte | Intérêt légitime | 12 mois (échecs : 30 jours) | Pas d'IP ni d'e-mail (empreinte SHA-256 pour les échecs) |
| Facturation / ventes | Gestion commerciale | Clients | Montants, noms | Obligation légale | 10 ans (obligation comptable) | |

## C. Droits des personnes — comment les traiter
- **Accès / portabilité** : Clients → fiche client → « Exporter les données du client » (JSON).
- **Effacement** : « Supprimer ce client » (supprime commerce, avis, chiffres, tâches, messages et compte) ; pour un auteur d'avis isolé, supprimer l'avis dans la fiche.
- **Rectification** : modification directe dans la fiche.
- Répondre sous **1 mois** ; consigner la demande et la réponse ici : [date — demandeur — action].
