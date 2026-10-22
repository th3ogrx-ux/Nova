# Procédure en cas de violation de données (fuite, accès non autorisé, perte)

> Une **violation** = accès, divulgation, altération ou perte de données personnelles, accidentelle ou malveillante. **Délai : 72 heures** pour notifier la CNIL à partir du moment où tu en as connaissance.

## 1. Contenir (immédiat)
1. **Révoquer les accès** : Supabase → Authentication → Users : supprimer ou bloquer le compte suspect ; changer le mot de passe admin ; déconnecter toutes les sessions.
2. Si une clé a fuité : **régénérer** les clés Supabase (Project Settings → API) et mettre à jour Vercel ; régénérer `service_role` surtout.
3. Si besoin, **mettre le projet en pause** (Supabase → Settings → General → Pause) le temps de comprendre.
4. **Conserver les preuves** : exporter `audit_log` (Table Editor → Export) et les logs Supabase/Vercel avant toute purge.

## 2. Évaluer (dans les 24 h)
- Quelles données ? Combien de personnes/entreprises ? Pendant combien de temps ? Données sensibles ?
- Risque pour les personnes : faible / élevé (usurpation, atteinte à la réputation…).
- Noter tout dans le registre des violations (modèle ci-dessous), **même si la CNIL n'est pas prévenue**.

## 3. Notifier
| Qui | Quand | Comment |
|---|---|---|
| **CNIL** | Sous 72 h si la violation présente un risque pour les personnes | notifications.cnil.fr (téléservice « Notifier une violation ») |
| **Entreprises clientes** (tu es leur sous-traitant) | **Sans délai** : elles doivent pouvoir notifier à leur tour | E-mail + appel : nature, données, mesures prises |
| **Personnes concernées** | Sans délai si le risque est **élevé** | E-mail clair : ce qui s'est passé, conséquences, ce qu'elles peuvent faire, contact |

## 4. Corriger et apprendre
Corriger la cause, tester (`npm test`), documenter, mettre à jour `docs/SECURITE.md`.

## Registre des violations (modèle)
| Date de découverte | Description | Données/personnes | Risque | Notifié CNIL ? (date) | Clients prévenus ? | Mesures |
|---|---|---|---|---|---|---|
| | | | | | | |
