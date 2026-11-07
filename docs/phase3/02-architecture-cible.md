# Phase 3 · 02 — Architecture cible : local-first, synchronisée par le cloud

Statut : **proposition à valider**. Rien n'est créé ni souscrit.
Conventions : [Fait] dépôt · [Doc] documentation officielle · [Hypothèse] · [Reco] · [Décision] à valider.

## 1. Principe
Panel reste une application **complète sans réseau**. Le cloud ne sert que :
1. à sauvegarder hors de l'appareil ;
2. à retrouver ses données sur un autre appareil ;
3. à synchroniser plusieurs appareils.

L'IndexedDB et le localStorage locaux restent la source de lecture et d'écriture de l'interface. Le serveur est la **référence de convergence** entre appareils, jamais un passage obligé pour lire ou écrire.

## 2. Solutions étudiées

| Critère | **Supabase** (Postgres managé + Auth + RLS) | Firebase (Firestore + Auth) | PowerSync (+ Postgres/Supabase) | Backend sur mesure (Node + Postgres managé UE) | PocketBase / Appwrite (auto-hébergés) |
|---|---|---|---|---|---|
| Sécurité des données | RLS Postgres côté serveur [Doc] ; politiques testables (pgTAP) | Règles de sécurité Firestore ; NoSQL | Hérite de la base ; règles de synchronisation | Totale maîtrise, mais tout est à écrire | Bonne, mais l'exploitation est à notre charge |
| Hors ligne | À construire (client) | Natif : persistance IndexedDB, **dernier écrit gagne** par document [Doc] | Natif : SQLite client, file d'envoi | À construire | À construire |
| Fusion des conflits | Libre (fonctions SQL) | Dernier écrit par document : insuffisant pour Panel | Envoi géré par l'application (fonction serveur) | Libre | Libre |
| Coût initial | Gratuit en développement (2 projets, **pause après 1 semaine d'inactivité, pas de sauvegarde**) [Doc] | Gratuit (Spark) | Gratuit en cloud (désactivé après inactivité) ou auto-hébergé [Doc] | Hébergement et Postgres managé payants dès le départ | VPS payant + temps d'exploitation |
| Coût récurrent | Pro **25 $/mois** : 100 000 MAU, 8 Go de disque, sauvegardes quotidiennes de 7 jours ; plafond de dépense actif par défaut [Doc] | À l'usage (lectures et écritures) : difficile à borner | **À partir de 49 $/mois** en cloud Pro, en plus de la base [Doc] | Variable | Faible en argent, élevé en temps |
| Web / Android | supabase-js, compatible Capacitor (WebView) | SDK web, compatible | SDK web avec wa-sqlite : **refonte du stockage local** | Libre | SDK JS |
| Migrations | Fichiers SQL versionnés (CLI) | Pas de schéma : migrations applicatives | Celles de la base + règles de synchronisation | Libres | Spécifiques |
| Croissance | Postgres : montée en calcul, réplicas | Très élevée | Élevée | Selon la conception | Limitée (une instance) |
| Dépendance fournisseur | **Faible à moyenne** : Postgres standard, Auth GoTrue open source, auto-hébergement possible | **Forte** (format propriétaire) | Moyenne (licence FSL pour le service) | Nulle | Faible |
| Résidence UE | Région choisie, par exemple Paris `eu-west-3` ou Francfort `eu-central-1` ; DPA disponible [Doc] | Régions UE disponibles | Selon l'hébergement | Au choix | Au choix |

### Recommandation [Reco]
**Supabase** (Postgres + Auth + RLS), avec un **protocole de synchronisation propre à Panel** fait de fonctions SQL et d'un module client.

- **Pourquoi pas Firebase** : la règle « dernier écrit gagne » par document contredit l'exigence « aucune perte silencieuse ». Le format propriétaire augmente aussi la dépendance.
- **Pourquoi pas PowerSync tout de suite** : il impose SQLite côté client, donc la réécriture de toute la persistance locale (localStorage, puis deux bases IndexedDB). Le coût cloud s'ajoute aussi à celui de la base. On peut le réévaluer si le moteur maison atteint ses limites ; le schéma serveur proposé y reste compatible (tables Postgres classiques).
- **Pourquoi pas un backend sur mesure** : il faudrait réécrire l'authentification (vérification d'e-mail, rotation des jetons, limitation de débit), un domaine où l'erreur coûte cher. Supabase couvre ce besoin. Un backend sur mesure reste possible plus tard **au-dessus de la même base**.
- **Atténuation de la dépendance** :
  - toute la logique est en SQL versionné dans le dépôt (`backend/supabase/migrations`) ;
  - le client passe par une petite couche d'adaptation (`PanelCloud`) ;
  - pas de dépendance à Realtime pour la justesse des données (Realtime ne sert éventuellement qu'à déclencher une synchronisation) ;
  - export logique régulier de la base.

### [Décision] à valider
- Fournisseur : Supabase (recommandé).
- Région UE : Paris `eu-west-3` (recommandé, public francophone) ou Francfort.
- Formule : gratuite en développement ; **Pro avant toute bêta ouverte**, car la formule gratuite n'a ni sauvegarde, ni protection contre les mots de passe fuités, et met le projet en pause.
- SMTP personnalisé avant toute bêta : le fournisseur intégré est limité à 2 e-mails par heure [Doc].
- Hébergement de l'application web (aujourd'hui un fichier local ou `localhost`) : un hébergement statique HTTPS est indispensable pour le multi-appareil web (Cloudflare Pages, Netlify ou équivalent) ; à choisir.

## 3. Schéma d'architecture

```
┌──────────────────────── Appareil (Web PWA ou Android Capacitor) ────────────────────────┐
│  Interface Panel (index.html) ──► domaines existants (collection, emplacements,          │
│                                   séries suivies, pull, Explorer…)                       │
│        │ persistance locale inchangée : localStorage + IndexedDB panel-library/catalog   │
│        ▼                                                                                 │
│  Capture des changements (diff par empreinte, à la persistance)                          │
│        ▼                                                                                 │
│  panel-sync (IndexedDB, nouvelle base) : outbox · shadow · state · conflicts · journal   │
│        ▼                                       ▲                                         │
│  PanelCloud (module séparé)                    │ application des changements distants    │
│   · AuthAdapter (supabase-js, stockage web / Keystore Android)                           │
│   · SyncClient (push par lots idempotents, pull paginé, retries + backoff)               │
└─────────────────────────────────────────┬────────────────────────────────────────────────┘
                                          │ HTTPS (TLS) · JWT utilisateur · clé publiable
┌─────────────────────────────────────────▼────── Supabase (région UE) ────────────────────┐
│  Auth (GoTrue) : e-mail + mot de passe, vérification, réinitialisation, rotation jetons  │
│  PostgREST / RPC : sync_push(ops) · sync_pull(since) · export_my_data() …                │
│  Postgres : schéma app (profiles, user_settings, devices, domaines personnels,           │
│             sync_ops, sync_conflicts) — RLS sur toutes les tables exposées               │
│  Edge Function (clé secrète serveur uniquement) : suppression de compte                  │
│  Sauvegardes : quotidiennes (Pro, 7 j) + export logique planifié hors fournisseur        │
└──────────────────────────────────────────────────────────────────────────────────────────┘
   Inchangé et hors cloud : serve.js (relais local GCD, Metron, Comic Vine) ; sources tierces.
```

## 4. Composants et responsabilités
| Composant | Responsabilité | Ne fait pas |
|---|---|---|
| Interface et domaines existants | Lire et écrire localement, comme aujourd'hui | Aucun appel réseau de synchronisation |
| Capture des changements | Comparer l'état persisté à la copie de référence (`shadow`) et produire des opérations par champ | Ne bloque jamais une écriture locale |
| `panel-sync` (IndexedDB v1, nouvelle base) | File d'envoi, copie de référence, curseur de réception, conflits, journal | Ne touche ni `panel-library` ni `panel-catalog` (pas de montée de version) |
| `PanelCloud.Auth` | Session, rafraîchissement, déconnexion, appareils | Ne stocke jamais de mot de passe |
| `PanelCloud.Sync` | Envoi par lots, réception paginée, application, retries, état | Ne résout pas seul un conflit qui menace des données |
| Postgres + RLS | Isolation par utilisateur, versions serveur (`rev`), idempotence, fusion par champ | Aucune confiance dans le client |
| Fonction de suppression de compte | Opérations à privilège (suppression de l'utilisateur Auth) | Jamais appelée sans session et confirmation |
| Sauvegardes | Reprise après incident côté serveur ; export par utilisateur | Ne remplace pas la sauvegarde JSON locale |
| Observabilité | Journaux Supabase, journal de synchronisation local consultable, compteurs d'erreurs | Pas de traqueur tiers sans décision (RGPD) |

## 5. Domaines métier et modularité
Il s'agit d'un **monolithe modulaire**, sans microservices : une base Postgres avec un schéma `app` et des modules SQL par domaine, et côté client un module par domaine dans `PanelCloud`.

| Domaine | Données | Phase 3 |
|---|---|---|
| Identity | `auth.users` (Supabase), `devices` | Lot 3.2 |
| User Profiles | `profiles`, `user_settings`, réglages de confidentialité | Lot 3.3 |
| Collection | `copies` (exemplaires, wishlist incluse) | Lots 3.4 et 3.5 |
| Organisation physique | `locations` | Lots 3.4 et 3.5 |
| Séries suivies | `series_follows` | Lot 3.4 |
| Pull List | `pulls` (références de publication, sans copier le catalogue) | Lot 3.4 |
| Wishlist | dans `copies` (`is_wishlist`, `wish`) : un exemplaire voulu est une fiche | Lot 3.4 |
| Reading Guides (personnels) | `user_guides` (guides créés ou importés) | Lot 3.4, facultatif |
| Reading Progress | `reading_progress` | Lot 3.4 |
| Catalogue / Publications | **local**, dérivé ou alimenté par des sources sous licence ; non synchronisé en Phase 3 | Décision juridique avant toute mutualisation |
| Discovery, Community | Hors Phase 3 | Le modèle `profiles` + `privacy` + `handle` les prépare |

Règle : **aucune table personnelle n'est lisible par un autre utilisateur en Phase 3.** Les futurs profils publics passeront par des vues dédiées, en lecture seule, gouvernées par les réglages de confidentialité.

## 6. Flux de données
1. **Utilisateur non connecté.** Comportement identique à aujourd'hui. `panel-sync` peut ne pas exister ; aucun appel réseau vers le cloud.
2. **Utilisateur connecté.**
   - Chaque `persistSingles()` (et équivalent par domaine) programme une capture différée de 1 à 2 s.
   - La capture écrit des opérations dans `outbox`.
   - Le client envoie dès qu'il est en ligne, par lots de 200 opérations au plus, puis reçoit ce qui a changé depuis son curseur.
3. **Modification hors ligne.** L'écriture locale est immédiate et l'opération attend dans `outbox`, qui est persistante (survit au redémarrage). L'interface indique « N modification(s) en attente ».
4. **Reconnexion.**
   - Déclencheurs : `online`, retour au premier plan ou minuterie.
   - Le client envoie la file dans l'ordre, chaque opération avec son `op_id` (UUID).
   - Le serveur répond, pour chaque opération : appliquée, déjà appliquée ou conflit.
   - Le client reçoit ensuite les changements et avance son curseur seulement après les avoir appliqués localement.
5. **Nouvel appareil.**
   - Connexion, puis réception complète paginée dans une zone tampon.
   - **Aperçu** : « 3 214 exemplaires, 52 emplacements… ».
   - Si l'appareil a déjà des données locales, on bascule sur le parcours de **fusion** du document [`04-synchronisation.md`](04-synchronisation.md) § 6. Il n'y a jamais d'écrasement.
6. **Modification simultanée sur deux appareils.**
   - Champs différents : fusion automatique.
   - Même champ : règle propre au domaine (voir [`04`](04-synchronisation.md) § 4). Une valeur perdante est toujours conservée dans `sync_conflicts`.
7. **Restauration d'une sauvegarde JSON.**
   - Elle reste locale, avec ses protections existantes.
   - Ses effets passent ensuite par la capture des changements, avec un **aperçu de synchronisation obligatoire** au-delà de 50 changements ou dès qu'il y a une suppression.
8. **Suppression du compte.**
   - Réauthentification, export proposé, confirmation écrite.
   - La fonction serveur supprime les données personnelles et l'utilisateur Auth.
   - Les données locales de l'appareil sont conservées, sauf choix explicite.
   - Les sauvegardes du fournisseur expirent selon leur durée de rétention (7 jours en Pro), ce qui est mentionné dans la politique de confidentialité.

## 7. Gestion des secrets
- **Client** : uniquement l'URL du projet et la **clé publiable** (anon ou publishable), qui sont publiques par nature. La sécurité repose sur la RLS.
- **Serveur** : la clé secrète (service role) **n'est jamais** dans le dépôt, dans le client ni dans `www`. Elle n'existe que dans les secrets de la fonction serveur et dans `.secrets/` en local.
- **Dépôt** : `backend/.env.example` sans valeur ; un script d'analyse des secrets (lot 3.1) bloque les motifs de clés.

## 8. Déploiement et environnements
| Environnement | Base | Usage |
|---|---|---|
| `local` | Postgres embarqué de test (PGlite) et/ou pile Supabase locale (Docker) | Migrations, RLS, tests de synchronisation |
| `staging` | Projet Supabase gratuit (UE) | Intégration Web et Android ; données factices uniquement |
| `production` | Projet Supabase Pro (UE) | Après validation du lot 3.7 |

Les migrations s'appliquent par la CLI (`supabase db push`) depuis le dépôt, jamais à la main en production.

## 9. Compatibilité Web / Android
- **Web** : la session supabase-js est stockée dans le navigateur (localStorage par défaut) [Hypothèse fondée sur la documentation de `signOut`]. La CSP et l'absence de XSS sont donc obligatoires.
- **Android** : adaptateur de stockage de session sur un plugin Capacitor appuyé sur l'**Android Keystore** (à évaluer : `@aparajita/capacitor-secure-storage` ou Capawesome Secure Preferences), jamais `@capacitor/preferences` [source tierce, à vérifier dans les dépôts des plugins]. Liens de vérification e-mail par App Links.
- **`allowBackup`** : à passer à `false`, ou exclure les préférences de session des règles de sauvegarde, avant le lot 3.2.

## 10. Coûts et dépendances (estimation, hors taxes)
| Poste | Développement | Bêta / production |
|---|---|---|
| Supabase | 0 $ (gratuit) | 25 $/mois (Pro, avec 10 $ de calcul Micro inclus) ; PITR en option : 100 $/mois pour 7 jours, non recommandé au départ [Doc] |
| SMTP transactionnel | 0 € (offre gratuite d'un fournisseur UE, à choisir) | Selon le volume |
| Hébergement web statique | 0 € (offres gratuites) | 0 € à quelques €/mois |
| Domaine | — | Environ 10 €/an |
| Sauvegarde logique hors fournisseur | 0 € (stockage chiffré personnel) | Quelques € |

Aucune dépense n'est engagée sans décision explicite de l'utilisateur.

## Sources (consultées le 7 novembre 2026)
- Supabase, tarifs : https://supabase.com/pricing
- Supabase, sessions Auth : https://supabase.com/docs/guides/auth/sessions
- Supabase, déconnexion (portées `global`/`local`/`others`) : https://supabase.com/docs/reference/javascript/auth-signout
- Supabase, Row Level Security : https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase, limites de débit Auth : https://supabase.com/docs/guides/auth/rate-limits
- Supabase, sécurité des mots de passe : https://supabase.com/docs/guides/auth/password-security
- Supabase, sauvegardes : https://supabase.com/docs/guides/platform/backups
- Supabase, régions : https://supabase.com/docs/guides/platform/regions
- Supabase, RGPD : https://supabase.com/docs/guides/security/gdpr-compliance
- Firebase, données hors ligne : https://firebase.google.com/docs/firestore/manage-data/enable-offline
- PowerSync, tarifs : https://www.powersync.com/pricing
- Plugins Capacitor de stockage sécurisé (sources éditeurs, à vérifier) : https://capawesome.io/docs/sdks/capacitor/secure-preferences/ · https://www.npmjs.com/package/@klassicd/capacitor-secure-storage
