# Runbook — Incident de sécurité ou de données

Lot 3.6 (D-45). Aucune base réelle n'existe : ce runbook **n'a jamais été exécuté**. Il s'applique à partir du lot 3.2.

## 1. Qualifier (dans l'heure)
| Signal | Gravité | Exemple |
|---|---|---|
| Fuite de la clé de service, d'un mot de passe de base ou d'une sauvegarde | Critique | clé dans un commit, un journal, une capture |
| Données d'un compte visibles par un autre | Critique | régression RLS |
| Perte ou corruption de données synchronisées | Haute | conflit non consigné, ligne effacée |
| Abus (rafales d'écritures, comptes en masse) | Moyenne | `rate_limited` en série dans les journaux |
| Panne du fournisseur | Moyenne | Supabase indisponible : l'application reste utilisable hors ligne |

Notez l'heure de découverte, qui l'a constaté, et ce qui a été observé. Ne supprimez aucune trace.

## 2. Contenir
- **Clé de service exposée** : faites-la tourner dans le tableau de bord Supabase (Settings → API), redéployez les Edge Functions, révoquez les sessions. Voir [`secrets.md`](secrets.md).
- **Régression RLS** : désactivez la synchronisation côté client (`PANEL_SYNC_ENABLED = false` puis nouvelle version du service worker). Les données locales restent intactes et l'outbox est conservée. Ensuite, rejouez `backend/tests/verify-supabase.sql` sur le projet.
- **Abus** : abaissez `app.service_limits.sync_ops_per_minute` avec la connexion de service. Au besoin, révoquez l'appareil fautif (`api.revoke_device`) ou bloquez le compte dans Auth.
- **Corruption** : n'écrivez plus rien sur le projet. Restaurez d'abord dans un projet de test ([`sauvegarde-restauration.md`](sauvegarde-restauration.md)), puis comparez les empreintes table par table.

## 3. Corriger et vérifier
1. Corrigez par une migration additive, jamais par une modification à la main en production.
2. Rejouez `npm run test:all` en local, puis `verify-supabase.sql` sur le projet.
3. Si des pierres tombales ont été purgées pendant l'incident, relevez `purged_below_rev`. Les clients concernés passent alors en resynchronisation complète (`resync_required`).

## 4. Informer
- Données personnelles exposées : le RGPD (article 33) impose de notifier la CNIL dans les 72 heures. Informez les personnes concernées si le risque est élevé. **Faites valider la démarche par un professionnel** (`05` § 4.4).
- Consignez l'incident dans `docs/DECISIONS.md` : cause, correctif, décision prise.

## 5. Après l'incident
- Ajoutez un test de non-régression (`backend/tests/`).
- Relisez ce runbook et datez la relecture.
