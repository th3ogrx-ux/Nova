# Épisode 2 - "Ne m'oublie pas" : voix

| Personnage | Voix (Piper) | Licence | Traitement |
|------------|--------------|---------|------------|
| Noé | fr_FR siwis (identique à l'épisode 1) | CC BY 4.0 | aucun |
| Le Gris | fr_FR siwis (identique à l'épisode 1) | CC BY 4.0 | grave (x0,72), lente, écho ; plus forte au plan 8 |
| Lina | fr_FR upmc "jessica" | CC BY-SA 4.0 (jeu de données UPMC, attribution à citer) | aucun |
| La boulangère | fr_FR mls, locutrice 9 | CC BY 4.0 (jeu de données MLS) | douce, filtrée (passe-bas), écho long, "lointaine" |

Minutage : p01 0,30 | p02 3,10 | p03 6,20 | p04 12,20 | p05 15,40 (Gris) | p06 20,15 (Lina) / 21,45 (Noé) / 23,15 (Lina) | p07 25,30 (Lina) | p08 31,45 (Gris, colère) | p09 37,40 (boulangère) / 39,60 (Noé) | p10 43,40 (Lina) | p11 46,20 (boulangère) | p13 51,10 (Noé).
Silences : 14,0-15,0 ; 36,0-37,0 ; 49,0-51,0 (coupure).
Régénérer : node episodes/rendre-episode.cjs episodes/episode-02-ne-moublie-pas video <images> <muet.mp4> puis
python3 episodes/episode-02-ne-moublie-pas/son/composer-son.py <dossier_tts> <travail> <muet.mp4> export/episode-02.mp4
