# Runbook — Secrets

## Où vivent les clés
| Secret | Emplacement | Versionné |
|---|---|---|
| Clé Comic Vine, identifiants Metron, adresses de relais | `localStorage` de l'appareil ; jamais synchronisés (`SYNC_DOMAINS` : `secrets`) | Jamais |
| URL et clé publique Supabase (*publishable*) | `backend/.env` local (modèle : `backend/.env.example`), puis la configuration de compilation du client au lot 3.2 | Seul le modèle, sans valeur |
| Clé de service Supabase (*service role* / *secret key*) | Tableau de bord Supabase et secrets des fonctions serveur seulement | **Jamais**, et jamais dans le client |
| Fichiers personnels | `.secrets/` | Jamais (ignoré par `.gitignore`) |

## Contrôle
```bash
npm run check:secrets
```
Le détecteur parcourt seulement les fichiers suivis par Git. Il signale :
- les jetons JWT et les clés de service ;
- les clés Supabase secrètes et les clés Stripe ;
- les clés hexadécimales de 40 caractères ;
- les mots de passe en clair et les URL contenant des identifiants ;
- les clés privées ;
- un `.secrets/`, un `.env`, un cache ou une sauvegarde suivis par Git.

Les valeurs sont toujours masquées dans la sortie. Les exceptions sont listées et justifiées dans `scripts/check-secrets.js`.

## En cas de fuite
1. Révoquez immédiatement la clé auprès de son service. Une clé versionnée est considérée comme compromise, même après suppression.
2. Créez une nouvelle clé et mettez-la à jour localement.
3. Ne réécrivez pas l'historique Git sans l'accord de l'utilisateur, car c'est une opération destructive.
4. Consignez l'incident dans `docs/HISTORIQUE-LOTS.md`, sans la valeur.

## Interdits
- Ne jamais coller une clé dans un document, un test, un message de commit ou une conversation.
- Ne jamais réutiliser un mot de passe d'un autre service.
- Ne jamais lire le contenu de `.secrets/` dans un script automatisé.
