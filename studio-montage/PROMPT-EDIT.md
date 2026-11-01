# Prompt à envoyer pour chaque nouvelle vidéo

Copie le bloc ci-dessous dans la conversation, **joins ta vidéo au même message**, et remplis les 4 champs entre crochets
(les autres réglages sont déjà décidés).

```text
Monte cette vidéo (jointe à ce message) avec le studio de montage du dépôt, dans studio-montage/, sur la branche courante.
Toutes les décisions de style sont déjà prises : applique-les sans me reposer de questions.

MES 4 INFOS POUR CETTE VIDÉO
1. Titre fixe du haut : « [ligne 1] » / « [ligne 2 en italique rouge] »
2. Texte exact de la vidéo (sert à corriger la transcription) :
[colle ici ce que je dis, mot pour mot]
3. Mot à commenter à la fin : [MARQUE] — offre : [diagnostic gratuit]
4. Particularités : [rien / ou : « coupe les silences », « 2 gros plans seulement », « fond noir »…]

ÉTAPES
0. Copie la vidéo jointe dans studio-montage/entree/ (sans toucher à l'original). Si c'est une session neuve et que
   .venv/, modeles/ ou animations/node_modules/ manquent, lance `node installer.js` : je l'autorise (environ 1,5 Go).
   Enregistre mon texte exact dans entree/<nom>.script.txt.
1. Lance `node montage.js <video> --transcrire-seulement --vocabulaire "<mots-clés de mon texte>"`.
   Vérifie les mots et les temps. Signale-moi tout mot douteux.
2. Écris un scenes-<nom>.json :
   - une animation environ toutes les 2 secondes, calée sur les mots dits (utilise les temps de entree/<nom>.mots.json) ;
   - types disponibles : titre (avec « surligne » = barre rouge qui balaie, « italique » = serif rouge), profil (faux profil
     Instagram avec une tuile qui compte jusqu'à une valeur), compteurs, orbite (icônes autour d'un libellé rouge),
     courbe, liste, comparaison, score ;
   - varie les types, ne répète pas deux fois de suite le même ;
   - tout chiffre inventé (vues, abonnés, scores) est un EXEMPLE : mets « Exemple : … » dans son titre. Aucune fausse statistique
     présentée comme vraie ;
   - 2 à 3 gros plans (clé « grosPlans ») sur les passages les moins visuels, environ 25 % du temps au total ;
   - dernière scène = appel à l'action : « Commente » + mot en barre rouge + l'offre en sous-titre.
   Vérifie qu'aucune scène ne chevauche une autre.
3. Contrôle avant le long rendu : fais quelques images fixes (remotion still) de chaque type de scène et d'un gros plan, et regarde-les.
   Corrige ce qui dépasse, se chevauche ou est coupé.
4. Lance le rendu complet : `node montage.js <video> --scenes scenes-<nom>.json --sortie <nom>.mp4`.
   Dis-moi la durée estimée AVANT, et ne le relance pas deux fois en parallèle.
5. Contrôle le fichier final : 1080×1920, 30 i/s, durée = celle de la vidéo, piste son AAC 48 kHz stéréo présente.
   Regarde des images extraites (vue normale et gros plan, titre présent / absent) avant de me l'envoyer.
6. Envoie-moi la vidéo, commite et pousse sur la branche (messages de commit en français).

STYLE (déjà dans config.json, ne change rien sauf si je le demande)
- Fond blanc cassé quadrillé (grille fine + points). Accent rouge #E5303A. Textes en Poppins ; titres de section en Playfair Display italique.
- Titre fixe en haut, du début à la fin, SAUF pendant les gros plans.
- Bas de l'écran : cadre aux coins arrondis (de 7 % à 93 % de la largeur, à partir de 73 % de la hauteur) avec ma photo
  fonds/cadre.jpg floutée ; ma silhouette est découpée par-dessus, la tête dépasse du cadre, épaules prolongées de 200 px.
- Sous-titres mot par mot (2 à 4 mots), noirs, Poppins Bold, juste au-dessus de ma tête, dans les marges de 15 %.
- Gros plan : tête en grand en plein écran sur la photo de chambre (pas mon vrai fond), sans titre, sous-titres blancs en gras
  sous le menton (gros_plan.y = 0,72), léger zoom.
- Son : volume normalisé (-14 LUFS), 48 kHz stéréo.

RÈGLES
- Ne modifie ni ne supprime mes fichiers d'origine. Travaille dans studio-montage/.
- Textes en français avec les bons accents. Explique-moi en phrases courtes.
- Si une étape échoue, dis-moi le problème en une phrase et propose une solution, sans recommencer en boucle.
- Dis-moi honnêtement ce que tu as vérifié et ce que tu n'as pas pu vérifier (tu ne peux pas écouter le son ni voir la vidéo en mouvement).
- Si je demande une petite retouche (position d'un texte, un gros plan…), ne refais pas tout le rendu : refais seulement
  les passages concernés et recolle-les dans la vidéo précédente, après avoir vérifié que les images de raccord sont identiques.
```

## Pour modifier un réglage une fois pour toutes

Dis-le-moi dans la conversation (« descends les sous-titres du gros plan », « titre plus bas »…). Je change `config.json`,
et ce prompt n'a pas besoin d'être modifié : les valeurs de style vivent dans `config.json`.

## Si tu envoies la vidéo depuis une nouvelle conversation

- Les gros dossiers (`.venv/`, `modeles/`, `animations/node_modules/`) ne sont pas dans git : la première fois, le studio
  se réinstalle avec `node installer.js` (quelques minutes).
- Le dossier réseau de ton environnement doit autoriser `github.com` et `huggingface.co`, sinon les modèles ne se téléchargent pas.
- Le rendu prend longtemps dans un environnement sans carte graphique : compte 20 à 30 minutes pour une vidéo de 35 secondes.
