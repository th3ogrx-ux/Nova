# Studio de montage vidéo automatique

Tu te filmes face caméra (vidéo verticale 9:16). Une seule commande :

1. transcrit ta voix (sous-titres mot par mot, en français) ;
2. découpe ta silhouette (visage, cheveux bouclés, bras, mains) ;
3. la place dans un cadre arrondi, avec ta tête qui dépasse du cadre ;
4. ajoute des animations dans la moitié haute ;
5. exporte `sortie/video.mp4` en 1080×1920, 30 images par seconde, avec ton son d'origine.

Tes vidéos d'origine ne sont **jamais** modifiées : le studio ne fait que les lire.

---

## 1. Installation (une seule fois)

Il te faut **Node.js**, **Python 3** et **ffmpeg** déjà installés sur ton ordinateur. Ensuite :

```bash
node installer.js
```

Ça crée un environnement Python dans `.venv/`, télécharge deux modèles et installe Remotion.
Tout reste dans ce dossier.

| Outil | D'où il vient | Taille |
|---|---|---|
| Robust Video Matting (découpe) | GitHub officiel de ses auteurs, `PeterL1n/RobustVideoMatting` | ~15 Mo |
| Whisper « small » (transcription) | `faster-whisper`, modèle `Systran/faster-whisper-small` sur Hugging Face | ~480 Mo |
| Remotion (animations) | npm, `remotion.dev` | ~300 Mo |

---

## 2. Utilisation

1. Mets ta vidéo dans `entree/`.
2. Mets la photo du cadre dans `fonds/cadre.jpg`.
3. Modifie `scenes.json` (les animations) et, si tu veux, `config.json` (les réglages).
4. Lance :

```bash
node montage.js
```

Il prend la première vidéo de `entree/`. Pour une vidéo précise :

```bash
node montage.js ma-video.mp4
```

Le résultat est dans `sortie/video.mp4`.

### Corriger les sous-titres avant le rendu

```bash
node montage.js --transcrire-seulement
```

Ça crée `entree/ma-video.mots.json` (même nom que ta vidéo). Ouvre-le, corrige le champ `"text"` de
chaque mot (garde l'espace devant chaque mot, sauf le premier). Puis relance `node montage.js` :
**tes corrections sont gardées**. Pour refaire la transcription : `node montage.js --retranscrire`.

Astuce : donne les mots difficiles à la transcription :

```bash
node montage.js --vocabulaire "Reels, Instagram, abonnés"
```

### Autres commandes utiles

```bash
node montage.js --fond noir                    # fond noir et courbes rouges, juste pour ce rendu
node montage.js --scenes autre-scenes.json     # un autre fichier d'animations
node montage.js --sortie reel-2.mp4            # un autre nom de fichier dans sortie/
node montage.js --refaire                      # recalcule tout (découpe comprise)
```

Les étapes lentes (découpe, silhouette) sont gardées en mémoire : si tu changes seulement un texte,
le deuxième rendu est bien plus rapide.

---

## 3. Changer les textes et les animations : `scenes.json`

Chaque scène a un `type`, un `debut` et une `duree` (en secondes). Les 5 types :

```json
{ "type": "titre", "debut": 0.3, "duree": 2.4,
  "texte": "Teste tes Reels", "italique": "avant de publier", "sousTitre": "3 accroches, 1 gagnant" }

{ "type": "comparaison", "debut": 3.0, "duree": 3.0, "titre": "Normal ou d'essai ?",
  "a": { "nom": "Normal",  "points": ["Tes abonnés seulement"] },
  "b": { "nom": "D'essai", "points": ["Des inconnus aussi"] } }

{ "type": "liste", "debut": 6.3, "duree": 3.0, "titre": "La méthode",
  "elements": ["Poste 3 accroches", "Compare les chiffres", "Garde la meilleure"] }

{ "type": "courbe", "debut": 9.6, "duree": 3.0, "titre": "Vues par accroche",
  "points": [2, 5, 4, 9, 14], "libelles": ["J1", "J2", "J3", "J4", "J5"] }

{ "type": "score", "debut": 12.9, "duree": 3.0, "titre": "Score des accroches",
  "elements": [ { "nom": "Accroche 1", "valeur": 5, "max": 10 } ] }
```

- Deux scènes ne doivent pas se chevaucher dans le temps.
- Les animations s'affichent dans le haut de l'écran (de 0 à 55 % de la hauteur).
- Le texte reste dans les marges de sécurité de 15 % à gauche et à droite.

---

## 4. Changer les réglages : `config.json`

| Réglage | Ce qu'il fait |
|---|---|
| `fond` | `"blanc"` (papier quadrillé) ou `"noir"` (noir et courbes rouges) |
| `couleurs.papier / noir / accent / texte` | les couleurs (l'accent est le rouge `#E5303A`) |
| `cadre.gauche / droite / haut` | position du cadre, en part de l'écran (0,07 = 7 %) |
| `cadre.rayon` | arrondi des coins, en pixels |
| `cadre.flou` | flou de la photo du cadre |
| `tete.hauteurPx` | taille de ta tête à l'écran : plus grand = tu apparais plus gros |
| `tete.debordement` | part de la tête au-dessus du cadre (0,5 = la moitié) |
| `tete.fractionHauteurTete` | réglage fin : part de la hauteur de ta vidéo occupée par ta tête (0,40 par défaut) |
| `tete.fonduBords` | adoucit les bords gauche et droit de ta silhouette (voir « Problèmes courants ») |
| `sous_titres.taille / y / couleur` | taille, hauteur (en part de l'écran) et couleur des sous-titres |
| `sous_titres.motsMax` | nombre maximum de mots à la fois (4 par défaut) |
| `animations.zoneBas` | jusqu'où descendent les animations (0,55 = 55 % de la hauteur) |

La police des sous-titres est **Poppins Bold**, incluse dans le projet. Les titres en serif italique
utilisent **Playfair Display**, aussi incluse.

---

## 5. Combien de temps ça prend ?

Mesures faites dans un environnement **sans carte graphique** (4 cœurs de processeur). Sur ton ordinateur,
le résultat peut être différent, souvent plus rapide pour le rendu.

| Étape | Pour 1 minute de vidéo |
|---|---|
| Découpe de la silhouette (RVM) | environ 5 à 6 minutes |
| Transcription (Whisper small) | environ 1 minute |
| Rendu Remotion | environ 25 minutes (c'est l'étape la plus lente) |

Pour aller plus vite :
- `node montage.js --qualite 0.35` : découpe plus rapide, contour un peu moins fin.
- Fais d'abord un test sur 5 à 10 secondes (la découpe et la silhouette sont gardées ensuite).
- Sur un ordinateur avec carte graphique, laisse Remotion utiliser son propre Chrome (ne définis pas
  `CHROME_PATH`) : le rendu y est en général beaucoup plus rapide que dans mes mesures.

---

## 6. Problèmes courants

**« L'environnement Python n'existe pas »** : lance `node installer.js`.

**Les épaules sont coupées ou transparentes sur les côtés.** Ta vidéo s'arrête sur les côtés : il n'y a
rien à dessiner au-delà. Le studio estompe ces bords (`tete.fonduBords`, 0 pour désactiver, 0,2 pour
estomper plus). Pour un résultat propre : filme-toi un peu plus loin de la caméra, ou augmente
`tete.hauteurPx` (par exemple 560) en descendant `sous_titres.y` (par exemple 0,50).

**Un mot est mal transcrit.** Lance `node montage.js --transcrire-seulement`, corrige le fichier
`entree/ta-video.mots.json`, puis relance `node montage.js`.

**Un liseré ou une main coupée.** Essaie `node montage.js --qualite 0.6 --refaire` (découpe plus fine,
plus lente). Une bonne lumière devant toi et un fond qui contraste avec tes cheveux aident beaucoup.

**Le texte de l'animation dépasse.** Raccourcis-le, ou diminue le nombre de lignes : la zone des
animations est limitée à `animations.zoneBas`.

**Le rendu échoue sur Chrome.** Remotion télécharge son propre Chrome la première fois (il faut
internet). Si tu veux utiliser ton Chrome : `CHROME_PATH="/chemin/vers/chrome" node montage.js`.

**C'est trop lent.** Voir la section 5.

---

## 7. Le dossier

```
entree/        tes vidéos (et les fichiers .mots.json de transcription)
fonds/         cadre.jpg : la photo du cadre
sortie/        video.mp4 : le résultat
animations/    le projet Remotion (les composants d'animation)
outils/        les scripts Python : découpe, silhouette, transcription
config.json    les réglages
scenes.json    les animations
montage.js     la commande unique
installer.js   l'installation
```
