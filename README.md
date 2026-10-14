# Zenoa Radar — base de design

Base vide, prête pour un nouveau projet. Ne contient plus que le design
visuel de l'ancien site (ZENOA) : menu latéral, barre du haut, page
d'accueil. Toutes les fonctionnalités, pages et scripts de l'ancienne
application ont été retirés.

## Démarrer

```bash
npm install
npm run dev      # serveur de développement
npm run build    # build de production dans dist/
```

Projet [Vite](https://vite.dev/) standard — Vercel le détecte et le build
automatiquement (`npm run build`, dossier de sortie `dist/`), sans
configuration supplémentaire.

## Structure

```
index.html              point d'entrée (sidebar + barre du haut + page d'accueil)
src/
  main.js                logique (toggle du menu, dialogue de confirmation)
  style.css               importe les 4 fichiers ci-dessous
  confirm-dialog.js       modale de confirmation réutilisable (window.confirmDialog)
  styles/
    tokens.css            variables CSS : couleurs, polices, rayons
    base.css               reset, scrollbar stylée, logo en dégradé
    components.css          boutons, cartes, champs, badges, switch, modale
    layout.css               sidebar, barre du haut, zone de contenu
public/                  logo, favicons, icônes PWA, manifest
```

## Design system

- **Polices** : Orbitron (logo "ZENOA"), Playfair Display (grands titres),
  police système par défaut pour le corps de texte.
- **Couleurs** : palette sombre (sidebar) + zone de contenu claire façon
  dashboard SaaS. Toutes les couleurs sont des variables CSS dans
  `src/styles/tokens.css` — à adapter à une nouvelle marque en changeant
  uniquement ce fichier.
- **Composants** : `.btn` (variantes `primary`/`blue`/`orange`/`danger`/`ghost`),
  `.card`, `.badge-pill` (variantes `purple`/`red`/`blue`), `.status-pill`
  (variantes `ok`/`warning`/`danger`), `.switch`, `.modal-overlay`/`.modal-box`,
  champs de formulaire (`input`/`textarea`/`select` stylés par défaut).
- La sidebar est repliable (bouton en haut à droite du menu) et reste
  fonctionnelle sur mobile (repli automatique en dessous de 640px).
