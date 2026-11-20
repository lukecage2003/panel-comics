# Lot S8 : comptes en ligne et contenu des autres (D-97)

Statut au 20/11/2026 : **préparé localement**. Rien n'est appliqué sur Supabase ni activé dans l'application.

## 1. Ce qui est prêt

| Élément | Fichier | Vérification |
|---|---|---|
| Migration 14, additive | `backend/supabase/migrations/20261120000014_social_notes_live.sql` | `npm run test:db` : 145/145, dont `social.test.js` (10 tests) |
| Module client pur | `domains/community/online-core.js` (`PanelDomains.online`) | 3 tests Node |
| Base déjà en place | migration 13 (membres, publications, abonnements, blocages, réactions, signalements, modération) | appliquée en préproduction (D-74) |

La migration 14 ajoute :

- **Pensées en ligne** : publications de type `note` (pensée, théorie, question), 500 caractères, mots-dièse indexés.
  - Un mot-dièse n'est retenu que s'il est réellement écrit dans le texte.
  - Le verdict d'une théorie est donné par son auteur seulement.
- **Tendances** : `api.trending_tags`, sur sept jours, pondérées par la fraîcheur (demi-vie 48 h). Elles sont calculées sur les seules publications que l'appelant a le droit de voir.
- **J'aime** : réaction `like` et forme choisie par chaque membre (`like_icon`, douze dessins de Panel).
- **Directs** :
  - salons (`live_rooms`, avec les deux camps du duel) ;
  - chat (`live_messages`, 200 caractères, 30 messages par minute, diffusé en temps réel sous RLS) ;
  - votes du duel (`live_votes`, un par membre ; seul le décompte est rendu).
- **Modération des directs** :
  - signalement d'un salon ou d'un message ;
  - masquage automatique à trois signalements, ou immédiat pour la sécurité d'un mineur ;
  - message retiré par son auteur, par l'hôte ou par la modération (journalisé) ;
  - `api.mod_live` pour le personnel, motif obligatoire.
- **Mêmes garanties qu'en migration 13** :
  - aucune écriture directe, toute écriture passe par une fonction `api.*` ;
  - aucun accès anonyme ;
  - un adulte ne voit jamais un mineur ;
  - le blocage est réciproque ;
  - tout disparaît en cascade quand un compte est supprimé.

Les images des pensées restent sur l'appareil : le stockage d'images (Cloudflare R2, D-04) n'est pas ouvert.

## 2. Étapes qui demandent l'accord de l'utilisateur

1. **Appliquer la migration 14** au projet de préproduction `rxqusnkvlybkgxzhsnpk`. C'est le contenu exact du fichier, et il n'y a aucune donnée utilisateur aujourd'hui.
2. **Réglages Auth** du projet (dans le tableau de bord Supabase, à faire par l'utilisateur) :
   - URL du site et URL de redirection ;
   - confirmation d'e-mail activée.
3. **Exposer le schéma `api`** dans Settings › API › Exposed schemas, s'il ne l'est pas déjà.
4. **Premier compte** : il est créé par l'utilisateur, jamais par Claude.
5. **Branchement de l'interface**, après le premier compte :
   - « Publier aussi en ligne » sur les pensées publiques ;
   - fil des abonnements ;
   - chat et votes en temps réel.
6. **Voix des directs** : il faut un serveur audio WebRTC, par exemple LiveKit. C'est un service externe, peut-être payant au-delà d'un palier gratuit. Le choix et l'accord reviennent à l'utilisateur ; Claude n'achète rien.

## 3. Conditions d'utilisation et modération (à valider avant l'ouverture publique)

- **Âge** :
  - moins de 13 ans : refusé ;
  - 13-14 ans : accord parental (majorité numérique française à 15 ans) ;
  - mineurs : profil jamais public, aucun contact possible avec un adulte.
- **Contenus interdits** : harcèlement, haine, contenu sexuel, violence réelle, données personnelles d'autrui, contrefaçon (scans complets de comics), spam, usurpation.
  - Les spoilers ne sont pas interdits, mais ils doivent être voilés.
- **Droit d'auteur** :
  - on peut montrer quelques pages pour en parler (courte citation) ;
  - un numéro entier est interdit ;
  - motif « copyright » au signalement.
- **Lieux de rencontre** (futur lot « Sorties ») : seulement des lieux publics (boutiques, conventions, bibliothèques), jamais d'adresse privée ; fonction réservée aux adultes.
- **DSA (règlement européen sur les services numériques)** :
  - point de contact ;
  - motif communiqué à la personne visée par une décision ;
  - possibilité de contester ;
  - rapport de transparence annuel.
  - Le journal `moderation_log` sert de base.
