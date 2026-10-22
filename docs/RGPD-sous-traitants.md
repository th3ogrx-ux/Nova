# Liste des sous-traitants et destinataires

> À vérifier et compléter. Un contrat de sous-traitance (DPA) existe en ligne avec Supabase et Vercel (à accepter dans leurs paramètres/espaces légaux).

| Prestataire | Rôle | Données concernées | Localisation | Garanties |
|---|---|---|---|---|
| **Supabase Inc.** | Base de données, authentification, stockage de fichiers, fonctions serveur | Toutes les données de l'application | **Région du projet : [À VÉRIFIER dans Project Settings → General]** (viser UE : Frankfurt / Paris). Société américaine | DPA + clauses contractuelles types ; SOC 2 |
| **Vercel Inc.** | Hébergement du site (fichiers statiques) | Adresse IP des visiteurs (journaux techniques), aucune donnée client | Réseau mondial, société américaine | DPA + clauses contractuelles types |
| **Have I Been Pwned (Cloudflare)** | Vérification qu'un mot de passe n'est pas dans une fuite | 5 premiers caractères d'une empreinte SHA-1 (anonyme) | Mondial | Méthode k-anonymat : le mot de passe n'est jamais transmis |
| **Microlink** | Aperçu d'un lien ajouté dans « Ressources » (admin uniquement) | URL saisie par l'admin | États-Unis/UE | Aucune donnée client |
| **YouTube (nocookie) / OpenStreetMap** | Vidéo ou carte incrustée (admin / pages de maquette publiques) | Adresse IP du visiteur de la page concernée | États-Unis / UE | Mode sans cookie pour YouTube |
| **E-mail** | Aucun service d'e-mail transactionnel n'est utilisé (identifiants transmis par l'admin) | — | — | — |

Polices : hébergées avec le site (Fontsource), aucun appel à Google Fonts.
