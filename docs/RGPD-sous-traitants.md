# Liste des sous-traitants et destinataires

> Rempli le 24/10/2026. Un contrat de sous-traitance (DPA) existe en ligne avec Supabase et Vercel (à accepter dans leurs paramètres/espaces légaux).

| Prestataire | Rôle | Données concernées | Localisation | Garanties |
|---|---|---|---|---|
| **Supabase Inc.** | Base de données, authentification, stockage de fichiers, fonctions serveur | Toutes les données de l'application | **Région du projet : eu-west-1 (Irlande, UE).** Société américaine | DPA + clauses contractuelles types ; SOC 2 |
| **Vercel Inc.** | Hébergement du site (fichiers statiques) | Adresse IP des visiteurs (journaux techniques), aucune donnée client | Réseau mondial, société américaine | DPA + clauses contractuelles types |
| **Have I Been Pwned (Cloudflare)** | Vérification qu'un mot de passe n'est pas dans une fuite | 5 premiers caractères d'une empreinte SHA-1 (anonyme) | Mondial | Méthode k-anonymat : le mot de passe n'est jamais transmis |
| **OpenStreetMap** | Carte incrustée dans les pages de maquette publiques | Adresse IP du visiteur de la page | Europe (OSM Foundation, Royaume-Uni) | Aucune donnée client |
| **PayPal (Europe) S.à r.l. et Cie, S.C.A.** | Paiements des clients | Nom, e-mail, montant de la transaction | Luxembourg / UE | Responsable de traitement pour ses propres obligations ; conditions PayPal |
| **E-mail** | Aucun service d'e-mail transactionnel n'est utilisé (identifiants transmis par l'admin) | — | — | — |

Polices : hébergées avec le site (Fontsource), aucun appel à Google Fonts.
