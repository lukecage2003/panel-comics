# Lot 3.7 — Matrice de validation V1 à V14 (état local)

Mise à jour : 8 novembre 2026 (D-44). Scénarios définis dans [`10`](10-dossier-lots-3.2-3.7.md) § 7.

**Validé localement** = test automatisé sur PGlite (PostgreSQL en WebAssembly) ou dans l'application (Edge, CDP), données fictives.
**Aucun de ces scénarios n'a été validé sur un projet Supabase réel ni sur un appareil Android** : ces validations restent à faire une fois le lot 3.2 réalisé par l'utilisateur.

| Scénario | Couverture locale | Test | Reste à valider en réel |
|---|---|---|---|
| V1 champs différents | Validé localement | `sync.test.js` « V1 » | Deux navigateurs réels, JWT réels |
| V2 même champ | Validé localement, résolution réversible | `sync.test.js` « V2 », `conflicts.test.js` « V2 », front test 45 (notes de lecture) | Idem |
| V3 hors ligne, même compte | Validé localement | `sync.test.js` « V3 et V10 » | Idem |
| V4 réseau coupé en plein lot | Validé localement | `sync.test.js` « V4 » | Réseau réel (mode avion) |
| V5 hors ligne prolongé | Validé localement (durée simulée : le protocole ne dépend pas de l'horloge murale) | `sync.test.js` « V5 » | Appareil réel hors ligne plusieurs jours |
| V6 suppression contre modification | Validé localement | `sync.test.js` « V6 », `conflicts.test.js` « V6 » | Idem |
| V7 sauvegarde JSON restaurée | Validé localement (aperçu, fusion par défaut, anti-cataclysme, annulation) | front tests 22, 32, 42 | — (local par nature) |
| V8 restauration serveur | **Approché** : restauration physique du répertoire PGlite, empreintes identiques, RLS et synchronisation fonctionnelles | `restore.test.js` | `pg_dump` / `pg_restore` dans un projet de test Supabase |
| V9 compte supprimé | Validé localement pour les données (`api.delete_my_data`), état local conservé, renvoi refusé | `privacy.test.js`, `sync.test.js` « V9 » | Suppression du compte `auth.users` (service), purge planifiée |
| V10 session expirée | Validé localement | `sync.test.js` « V3 et V10 », `adapters.test.js` | Expiration réelle d'un JWT Supabase |
| V11 interruption de réception | Validé localement | `sync.test.js` « V11 et V13 » | Fermeture réelle d'onglet |
| V12 appareil révoqué | Validé localement | `sync.test.js` « V12 », `roles.test.js`, `conflicts.test.js` | Idem |
| V13 mise à jour avec outbox pleine | Validé localement (rechargement du moteur) | `sync.test.js` « V11 et V13 » | Mise à jour réelle du service worker |
| V14 champ inconnu | Validé localement | `sync.test.js` « V14 » | Idem |

Bêta fermée : non engagée (nécessite un hébergement et des comptes, hors du périmètre autorisé).
