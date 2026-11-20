# Épisode 1 - "Il reste 2 minutes" : voix et minutage

Voix : Piper, modèle fr_FR "siwis" (jeu de données SIWIS, licence CC BY 4.0, attribution à citer si besoin).
Noé = voix de base ; le passant, le boucher, le Gris et les messages du téléphone = la même voix plus grave (le Gris avec écho).

| Plan | Début (s) | Qui | Texte |
|------|-----------|-----|-------|
| 1 | 0,30 | Noé | Si les lumières s'éteignent derrière toi... cours. |
| 3 | 4,10 / 6,60 | Noé / passant | Elle était là hier. La boulangerie. / Quelle boulangerie ? Il n'y a jamais rien eu ici. |
| 4 | 10,25 / 12,70 | message / Noé | Elle va s'éteindre. Toi seul peux la sauver. / Quoi ? |
| 5 | 13,55 | Noé | OK. OK. J'y vais. |
| 7 | 24,40 / 26,85 | le Gris / Noé | Tu ne peux pas tous les sauver, Gardien. / Je vais quand même essayer. |
| 9 | 33,95 / 36,55 | Noé / boucher | Bonjour ! Je voudrais deux steaks, s'il vous plaît ! / Ça fait longtemps qu'on n'avait pas vu de nouveau client, ici. |
| 10 | 39,90 | Noé | Il suffisait... que quelqu'un vienne. |
| 11 | 43,40 / 45,00 / 46,80 | le Gris / le Gris / Noé | (rire) / Ce n'était que la première. / Il y en a... combien ? |
| 14 | 53,10 | Noé | La carte existe vraiment. |

Plans 3 et 9 rallongés d'une seconde chacun (2 répliques ne tenaient pas) : durée totale 55 s.
Silence total de 51,0 s à 53,0 s. "Suite au prochain épisode." et "Lien en bio." restent à l'écran, non dits.
Régénérer : node episodes/rendre-episode.cjs episodes/episode-01-il-reste-2-minutes video <images> <muet.mp4> puis
python3 episodes/episode-01-il-reste-2-minutes/son/composer-son.py <dossier_tts> <travail> <muet.mp4> export/episode-01-il-reste-2-minutes.mp4
