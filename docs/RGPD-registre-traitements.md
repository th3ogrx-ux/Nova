# Registre des traitements (modèle — art. 30 RGPD)

> Rempli le 24/10/2026 avec les informations de l'éditeur. Deux registres sont à tenir : en tant que **responsable de traitement** (tes propres données : comptes, prospection) et en tant que **sous-traitant** (avis et chiffres de tes clients). À faire relire par un juriste.

**Responsable / sous-traitant :** Théo Gerber (Zenoa Agency), 57310, France, th3o.grx@gmail.com — Délégué à la protection des données : non désigné (non obligatoire à cette échelle).

## A. Zenoa agit comme sous-traitant (données des entreprises clientes)

| Traitement | Finalité | Personnes concernées | Données | Destinataires | Durée | Sécurité |
|---|---|---|---|---|---|---|
| Espace client : suivi des avis | Montrer au client ses avis et sa note | Auteurs d'avis (clients du client) | Prénom ou pseudo, note, texte, date | Le client, Zenoa | Contrat + 12 mois | RLS, HTTPS, journal |
| Espace client : chiffres | Suivi des vues, appels, itinéraires, etc. | Aucune personne identifiée | Chiffres agrégés par mois | Le client, Zenoa | Contrat + 12 mois | idem |
| Réseaux sociaux : statistiques, calendrier, collaborations | Suivre la gestion des comptes et des partenariats du client | Aucune personne identifiée (chiffres agrégés) ; contacts de marques éventuels | Abonnés, vues, portée, interactions ; titres et légendes de contenus ; nom de marque partenaire, statut, montant | Le client, Zenoa | Contrat + 12 mois | idem |
| Messagerie | Échanges client ↔ Zenoa | Contact du client | Nom du commerce, contenu des messages | Client, Zenoa | 24 mois (purge auto) | idem |
| Comptes de connexion | Authentification | Contact du client | E-mail, mot de passe (haché), date de dernière connexion | Zenoa, Supabase | Contrat | Hachage par Supabase Auth, 2FA proposée |

## B. Zenoa agit comme responsable de traitement

| Traitement | Finalité | Personnes | Données | Base légale | Durée | Notes |
|---|---|---|---|---|---|---|
| Prospection B2B (Radar, module Prospection) | Trouver et suivre des entreprises à démarcher | Dirigeants/entreprises prospectés | Nom du commerce, adresse, téléphone et e-mail professionnels, site, notes | Intérêt légitime (prospection B2B, art. L34-5 CPCE : information + droit d'opposition) | 3 ans après le dernier contact | Données issues de sources publiques (OpenStreetMap, fiches Google, sites web, comptes professionnels Instagram/TikTok). Contact par e-mail pro, message privé Instagram/TikTok ou téléphone. Mention d'information et possibilité de s'opposer (« stop ») dans le premier message ; retrait immédiat sur demande. |
| Journal de sécurité | Détecter les abus | Utilisateurs | Type d'événement, date, identifiant de compte | Intérêt légitime | 12 mois (échecs : 30 jours) | Pas d'IP ni d'e-mail (empreinte SHA-256 pour les échecs) |
| Équipe (membres) | Donner accès à l'appli à des collaborateurs | Membres de l'équipe | E-mail, pseudo, rôle, dernière activité | Contrat de collaboration (intérêt légitime) | Jusqu'à la fin de la collaboration | Droits par rôle appliqués par la base de données |
| Pages d'audit partagées | Compter les ouvertures des audits envoyés | Destinataires des audits | Date et heure d'ouverture (pas d'IP) | Intérêt légitime | Tant que l'audit existe | Lien privé, mot de passe et expiration facultatifs |
| Facturation / ventes | Gestion commerciale, paiements via PayPal | Clients | Montants, noms | Obligation légale | 10 ans (obligation comptable) | Paiement traité par PayPal |

## C. Droits des personnes — comment les traiter
- **Accès / portabilité** : Clients → fiche client → « Exporter les données du client » (JSON).
- **Effacement** : « Supprimer ce client » (supprime commerce, avis, chiffres, tâches, messages et compte) ; pour un auteur d'avis isolé, supprimer l'avis dans la fiche.
- **Rectification** : modification directe dans la fiche.
- Répondre sous **1 mois** ; consigner la demande et la réponse ici : [date — demandeur — action].
