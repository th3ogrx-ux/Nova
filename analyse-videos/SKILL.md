---
name: analyse-video-courte
description: Analyse une vidéo courte (Reel / TikTok) de Zenoa, face caméra, en français. À utiliser quand l'utilisateur envoie une vidéo ou son chemin avec ses chiffres (vues, likes, partages, durée de visionnage). Produit un diagnostic relié aux chiffres, 3 problèmes classés avec corrections, et met à jour suivi.csv.
---

# Analyse d'une vidéo courte (Zenoa)

## Contexte
Zenoa est une agence qui aide les marques (surtout de vêtements) à gagner en visibilité. Les vidéos sont face caméra, en français, pour attirer des fondateurs de marques. L'utilisateur est débutant : phrases courtes, termes expliqués.

## Règles
- N'invente aucun chiffre. Ne devine pas ce que tu ne vois pas ou n'entends pas.
- Sois honnête et direct, sans compliments creux.
- Ne modifie ni ne supprime jamais la vidéo d'origine. Travaille dans un dossier temporaire séparé.
- Écris tout en français, avec les accents.
- Si l'analyse est trop lente, dis combien de temps elle prend et propose une option plus rapide (modèle Whisper plus petit, moins d'images).
- Demande avant d'installer quoi que ce soit de lourd.

## Chiffres attendus
Plateforme, vues, likes, partages, durée moyenne de visionnage, durée totale de la vidéo. S'il en manque, dis lesquels et ce que cela empêche de savoir (ex. : sans durée de visionnage, impossible de dire où les gens décrochent).

## Étapes
1. **Infos de base** : `ffprobe` pour la durée, la résolution, la présence d'audio.
2. **Images** : extraire 1 image par seconde avec `ffmpeg` (plus dense sur les 3 premières secondes). Les regarder pour juger la lumière, le cadrage, les sous-titres, les changements d'image.
3. **Transcription** : extraire l'audio avec `ffmpeg`, puis transcrire avec faster-whisper (langue `fr`, horodatages par segment, et par mot si utile). Voir la section « Outils ».
4. **Analyse** :
   - Accroche (2 premières secondes) : promesse claire ? sujet compréhensible tout de suite ?
   - Rythme : phrases trop longues, silences, moments sans changement à l'image.
   - Valeur : idées précises et applicables, ou propos généraux ?
   - Sous-titres : présents, lisibles, synchronisés ?
   - Lumière et son : visage éclairé, bruit, volume.
   - Fin et appel à l'action : clair, un seul message ?
5. **Lien avec les chiffres** : relier chaque observation à un chiffre précis, avec l'horodatage. Exemple : « Les gens restent 6 s en moyenne, et à 6 s ta deuxième phrase commence ; elle est trop longue. » Dire clairement quand un lien est une hypothèse et non un fait.
6. **Les 3 problèmes principaux**, du plus important au moins important. Pour chacun : le constat (avec horodatage), pourquoi cela compte pour les chiffres, et une correction concrète (nouvelle phrase écrite mot pour mot, ou changement de montage précis).
7. **Suivi** : ajouter une ligne à `suivi.csv`.
8. **Bilan à 8 vidéos** : quand le tableau a au moins 8 vidéos, résumer ce qui marche le mieux (sujets, accroches, durées) en citant les lignes du tableau. Avec peu de vidéos, rester prudent sur les conclusions.

## Format de `suivi.csv`
Colonnes, dans cet ordre :
`date,plateforme,sujet,premiere_phrase,vues,likes,partages,duree_visionnage,probleme_principal`

- Date au format AAAA-MM-JJ.
- Mettre entre guillemets tout champ contenant une virgule.
- Chiffre inconnu : laisser vide, ne pas inventer.
- Ajouter une ligne à la fin, ne jamais réécrire les lignes existantes.

## Outils
- Environnement : `~/zenoa-outils/venv` (Python + faster-whisper). Modèle conseillé : `small` ; `base` si trop lent.
- Si l'environnement a disparu (le cloud est effacé après inactivité), le recréer après accord de l'utilisateur.
- Fichiers temporaires : dans un dossier `/tmp/analyse-<nom-video>/`, jamais à côté de la vidéo d'origine.
