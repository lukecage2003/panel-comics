# PANEL — Plan « Step qualité » (D-66)

Date : 14 novembre 2026. Statut : **proposé**. Ce plan reprend la demande du porteur du 14 novembre 2026 : tout améliorer, en détail. Il l'ordonne en étapes et le relie à la roadmap PRD ([`PANEL_ROADMAP.md`](PANEL_ROADMAP.md)), sans la remplacer.

**Règles qui ne changent pas** :
- la Collection garde sa structure ;
- aucune donnée n'est supprimée ;
- aucune image n'est inventée ;
- aucun faux utilisateur ;
- chaque étape se termine avec les tests verts, `check-boundaries --strict` et `check:secrets`.

---

## 1. Ce que dit la demande, regroupé

| Thème | Demandes |
|---|---|
| **Design** | Passer un cap de qualité visuelle partout, éléments 3D si cela apporte quelque chose, responsive irréprochable, stories plus belles sans effet « fait par IA ». |
| **Calendrier** | Sorties US alignées sur le mercredi ; éditions françaises (VF) reliées aux VO, avec dates passées et futures possibles ; boutique de comics la plus proche (VO et VF), sur consentement de localisation. |
| **Données** | La base comics la plus complète possible. Fiches personnage détaillées (première et dernière apparition, apparitions récentes, origine, ville, biographie, âge si une source le donne). Suivi d'un personnage. |
| **Notifications** | Tous les types : abonné, j'aime, commentaire, mention, sortie, personnage suivi… Dans l'application, sur le téléphone (push) et par e-mail, chacun accepté à l'inscription. |
| **Paliers** | Une image pour chaque niveau de compte, « comme sur Comic Geek ». |
| **Social** | Profil façon « Instagram des comics », original ; algorithme de fil inspiré des meilleurs, sans copier-coller. |
| **Lives** | Développer au maximum l'idée des débats en direct ([`LIVE-DEBATS.md`](../LIVE-DEBATS.md)). |
| **Explorer** | Catégorie Vidéo reliée aux chaînes YouTube et TikTok du créateur ; catégorie Actu et articles. |
| **Scan** | Fiable et bien cadré. |
| **Sécurité et modération** | Projet blindé ; données des utilisateurs et du porteur protégées ; code protégé ; limite d'âge ; zéro nudité ; modération irréprochable avec détection automatique. |
| **Code** | Pas de code mort ; structure précise. |

---

## 2. Points à trancher avant certaines étapes

Ce qui suit dépend d'un compte externe ou d'une question de droit. Rien de cela n'est activé sans accord explicite.

| # | Décision | Pourquoi | Recommandation |
|---|---|---|---|
| Q-A | **Images des paliers** | Les badges de League of Comic Geeks appartiennent à ce service : ils ne peuvent pas être repris. Les visuels « officiels » des personnages appartiennent aux éditeurs. | Badges **originaux Panel** en relief 3D (SVG et CSS, aucune dépendance). Le portrait du personnage du rang vient de Comic Vine, avec crédit, comme en D-64. Ou des illustrations commandées à un dessinateur. |
| Q-B | **E-mail** | L'envoi d'e-mails demande un fournisseur (compte à créer). | Brevo (entreprise française, offre gratuite de 300 e-mails par jour) ou Resend. |
| Q-C | **Push Android** | Le push natif Android passe par Firebase Cloud Messaging (compte Google). | Web Push (clés VAPID générées par Panel, aucun compte tiers) d'abord ; FCM ensuite pour l'APK. |
| Q-D | **Audio des lives** | Plus de 4 ou 5 participants demandent un serveur média. | LiveKit Cloud (offre gratuite) ou LiveKit auto-hébergé. |
| Q-E | **Chaînes du créateur** | Il me faut les adresses exactes. | YouTube : flux RSS public de la chaîne, sans clé. TikTok : n'a pas de flux public, donc lecteur intégré (oEmbed) vidéo par vidéo, ou API officielle après validation par TikTok. |
| Q-F | **Hébergement public** | Il faut un hébergeur pour mettre l'application en ligne et appliquer les en-têtes de sécurité. | Cloudflare Pages ou Netlify (déjà connectés à cet environnement) ; décision Q3 du PRD. |
| Q-G | **Âge minimum** | Selon le RGPD, en France, le consentement au traitement des données est valable seul à partir de 15 ans. | Inscription à partir de 13 ans avec un mode mineur. Ou à partir de 15 ans seulement, plus simple et plus sûr (je le recommande). |

---

## 3. Étapes, dans l'ordre

Chaque étape est livrable seule et testée. Les étapes 1 et 2 n'ont besoin d'aucun compte externe et peuvent commencer tout de suite.

### Étape 1 — Passe qualité et design de toutes les catégories (local)

**Objectif** : le niveau visuel et la finition d'une application de référence, catégorie par catégorie.

- **Audit ligne à ligne** de chaque écran, à 375, 768, 1280 et 1920 px, en clair et en sombre :
  - Accueil, Collection (finition seulement, structure inchangée), Calendrier, Pull list, Lecture, Explorer, Profil, Trophées, Réglages ;
  - chaque défaut est noté puis corrigé (alignements, états vides, chargements, focus clavier, cibles tactiles, textes coupés).
- **Système visuel** :
  - échelle typographique et espacements unifiés, ombres et reliefs cohérents ;
  - micro-animations sobres, désactivées avec `prefers-reduced-motion`.
- **3D utile** :
  - couvertures inclinables au survol ou au gyroscope, avec reflet ;
  - vue « Étagère » optionnelle de la Collection, avec les tranches en CSS 3D (la vue actuelle reste celle par défaut) ;
  - badges de paliers en relief (selon Q-A).
  - Tout est en CSS et SVG, sans bibliothèque lourde.
- **Stories** : une mise en page de type planche de BD (cases, phylactères, trames, typographie de lettrage) plutôt que des dégradés génériques. Transitions de page tournée, barre de progression en cases.
- **Scan** :
  - cadre de visée au format du code-barres (le code UPC et son code à 5 chiffres, qui donne numéro, variante et tirage) ;
  - recadrage de la zone analysée, lampe torche si l'appareil l'a, mise au point continue ;
  - détecteur natif `BarcodeDetector` quand il existe, ZXing sinon ;
  - retour sonore et vibration ; test sur de vrais codes de comics US et d'albums FR (EAN-13).
- **Code mort** :
  - script `scripts/check-dead-code.js`, qui liste les fonctions, classes CSS et identifiants jamais référencés ;
  - chaque élément est retiré seulement s'il est prouvé mort, avec un commit dédié ;
  - le script devient un contrôle de la suite.
- **Critères** :
  - 0 défaut ouvert dans l'audit ;
  - aucun défilement horizontal à 375 px ;
  - Lighthouse accessibilité ≥ 95 ;
  - scan réussi à au moins 95 % sur un lot de 40 codes réels.

### Étape 2 — Données comics complètes et calendrier VO/VF (local + relais)

**Objectif** : la fiche la plus complète possible, toujours sourcée.

- **Sources** :
  - **Comic Vine** : environ un million de numéros ; pour les personnages, nom réel, alias, origine, première apparition, nombre d'apparitions, équipes, pouvoirs, ennemis, créateurs ;
  - **Metron** : données récentes et précises ;
  - **Grand Comics Database** (CC BY-SA) : historique et réimpressions ;
  - **Wikidata** : SPARQL libre et sans clé ; données structurées (lieu de résidence, univers, créateurs, date de création) ;
  - **BnF** : interface SRU gratuite ; notices de dépôt légal des albums VF avec ISBN et dates ;
  - **Open Library** : couvertures par ISBN.
  - Chaque fait affiché indique sa source.
- **Fiche personnage** (exemple : Static) :
  - en-tête : portrait, nom réel, alias, éditeur, ville d'origine (Dakota, si la source le donne) ;
  - repères : première apparition et dernière apparition connue, cliquables ;
  - fil des apparitions récentes, biographie avec lien vers la source ;
  - équipes, alliés et ennemis ; créateurs ; lectures conseillées (guides Panel) ; ses numéros dans ma collection ;
  - bouton **Suivre**.
  - L'âge n'est affiché que si une source le donne (les âges de fiction sont rarement fixés).
- **Suivre** un personnage, un créateur, une série, un arc ou une équipe : suivi local tout de suite, synchronisé à l'étape 3, notifié à l'étape 4.
- **Calendrier US** :
  - chaque sortie US est rangée au mercredi de sa semaine (New Comic Book Day) ;
  - la date d'origine de la source est conservée et visible dans le détail ;
  - les sorties exceptionnelles (jours fériés) restent signalées.
- **VF reliée à la VO** :
  - modèle « édition » : un album VF contient une liste de numéros VO ;
  - sur chaque numéro VO : « Paru en VF dans… » (date passée, BnF ou éditeur) ou « VF annoncée » (programme publié par Urban, Panini ou Delcourt, saisi avec sa source) ;
  - à défaut : **« VF possible vers… »**, estimation calculée sur les délais habituels de l'éditeur, toujours marquée comme estimation et jamais présentée comme une date.
- **Critères** :
  - fiche Static complète avec au moins 8 faits sourcés ;
  - 100 % des sorties US au mercredi ;
  - 20 séries de référence avec correspondance VO/VF vérifiée à la main.

### Étape 3 — Comptes en ligne branchés (Supabase)

Base posée : 12 migrations appliquées (D-65).

- Inscription et connexion (e-mail et lien magique, Google en option), vérification d'âge (Q-G), consentements séparés (push, e-mail, localisation, personnalisation).
- Synchronisation de la collection existante, à partir d'un instantané restauré et testé ; appareils ; export et suppression du compte.
- Hébergement public (Q-F) avec en-têtes de sécurité (étape 8).
- **Critères** : matrice V1 à V14 validée sur Supabase réel ; aucune perte sur une copie de la collection réelle.

### Étape 4 — Notifications de tout type

- **Types** : nouvel abonné, demande d'abonnement, j'aime, commentaire, réponse, mention, partage ; sortie de la pull list ; FOC ; personnage, créateur ou série suivis ; VF annoncée ; live qui commence ; vidéo ou article du créateur ; trophée et palier ; décision de modération.
- **Canaux** : centre de notifications dans l'application (regroupement « X et 12 autres ont aimé »), push Web (Q-C), e-mail (Q-B, résumé quotidien ou hebdomadaire au choix). Chaque type est réglable par canal, avec heures calmes.
- **Serveur** : table `notify.*` avec RLS ; détection des sorties par tâche planifiée (pg_cron, puis Edge Function) qui croise les nouveautés avec les suivis.
- **Critères** : chaque type est déclenché en test ; aucun envoi sans consentement ; désinscription en un clic.

### Étape 5 — Le social : l'« Instagram des comics », en original

- **Profil** :
  - vitrine de la collection (étagère 3D), grille des planches et stories, « Comic DNA » (éditeurs, ères et personnages préférés) ;
  - palier et trophées, pull list publique au choix ;
  - lien « Nos collections se ressemblent à X % ».
- **Publications** : planche (montage de cases à partir de ses couvertures), critique avec note et spoilers floutés, « Haul du mercredi », question, sondage.
- **Fil**, inspiré des signaux publiés par Instagram (temps passé, partage, visite de profil, historique d'interaction), en version comics :
  - priorité aux numéros que je possède ou suis, aux séries communes, aux sorties de la semaine, aux personnes avec qui j'échange ;
  - pénalité pour les republications et les contenus signalés ;
  - « Pourquoi je vois ceci » sur chaque élément ;
  - fil chronologique disponible à tout moment (bonne pratique DSA).
- **Critères** : parcours publier, aimer, commenter, notifier de bout en bout ; aucune donnée privée exposée (test RLS d'intrusion).

### Étape 6 — Modération, âge et sécurité des personnes

- **Âge** : âge minimum à l'inscription (Q-G). En mode mineur : profil privé par défaut, pas de messages d'adultes inconnus, pas de localisation partagée.
- **Images** :
  - analyse sur l'appareil avant envoi (modèle libre de détection de nudité, type nsfwjs, sous licence MIT), puis contrôle serveur ;
  - au-delà d'un seuil, publication bloquée ; entre deux seuils, publication en file de modération.
- **Textes** : filtres d'insultes en plusieurs langues, liens et spam limités, limite de débit (migration 12), comptes neufs restreints.
- **Signalements** : décision motivée, appel, délais suivis, journal ; conforme au DSA (article 16 : signalement ; article 17 : motivation des décisions ; article 20 : réclamation).
- **Rôles** : modérateur et administrateur (migration 10) ; aucun accès aux données privées.
- **Critères** : jeu de test d'images refusé à 100 % ; parcours signalement, décision et appel de bout en bout.

### Étape 7 — Lives : l'idée phare

Base : [`LIVE-DEBATS.md`](../LIVE-DEBATS.md) (salons vocaux, trois rôles, tableau d'images partagé).

- **Formats** :
  - « **Mercredi Live** » hebdomadaire sur les sorties, ouvert depuis le calendrier ;
  - procès d'un événement, avec vote final ;
  - club de lecture synchronisé : tout le monde à la même page ou case ;
  - déballage du haul ;
  - avis de cote (sans transaction d'argent).
- **Fonctions** :
  - programmation et rappel (notification), salle d'attente ;
  - main levée, intervenants ;
  - réactions en onomatopées animées, sondages en direct ;
  - le tableau d'images puise dans la collection et dans Explorer ;
  - sous-titres automatiques si le serveur média les propose ;
  - replay découpé en chapitres, planche de synthèse publiée dans le fil.
- **Sécurité** : modération en direct (couper, exclure, signaler) et mode mineur. Enregistrement seulement avec l'accord des intervenants.
- **Technique** : serveur média (Q-D) avec des jetons émis par le backend ; état du salon dans Supabase Realtime.

### Étape 8 — Explorer : Vidéo, Actu et boutiques

- **Vidéo** : dernières vidéos des chaînes du créateur (Q-E) ; lecture intégrée ou redirection ; notification de nouvelle vidéo.
- **Actu et articles** : articles rédigés dans Panel (rôle `editor`, migration 10), avec brouillon, relecture, publication et liens vers les fiches. Liens vers les sources externes, jamais de reprise de texte.
- **Boutique la plus proche** :
  - localisation demandée seulement au moment voulu, calculée sur l'appareil et jamais stockée côté serveur ;
  - boutiques issues d'OpenStreetMap (libre, attribution ODbL) ;
  - liste vérifiée de librairies spécialisées VO et VF enrichie par Panel ;
  - horaires et itinéraire ; affichées depuis chaque sortie du calendrier.

### Étape 9 — Sécurité « blindée » et protection du code

- **Référentiel** : OWASP ASVS niveau 2 et OWASP Top 10. Outils reconnus :
  - gitleaks (secrets) ;
  - Dependabot et `npm audit` (dépendances) ;
  - CodeQL (analyse du code) ;
  - OpenSSF Scorecard ;
  - conseillers de sécurité Supabase.
- **Application** :
  - CSP stricte, HSTS, `frame-ancestors 'none'`, Permissions-Policy ;
  - jetons courts, double authentification pour les rôles staff ;
  - aucune clé privée dans le client (les clés tierces restent derrière le relais ou dans des Edge Functions) ;
  - captcha à l'inscription ;
  - tests d'intrusion sur la RLS ;
  - sauvegardes chiffrées et restauration testée.
- **Code** :
  - licence propriétaire explicite ;
  - code minifié en production ;
  - logique sensible côté serveur.
  - Limite honnête : le code d'une application web s'exécute chez l'utilisateur et ne peut pas être totalement caché. La protection réelle vient du serveur et du droit.
- **Données du porteur** : comptes protégés par double authentification ; clés en coffre (`.secrets/` jamais versionné) ; rotation documentée.

### Étape 10 — V1 européenne

- Internationalisation (anglais, puis allemand, espagnol, italien) ; éditions locales sur le modèle VO/VF.
- Rapport de transparence DSA ; offre Plus (PRD, phase 6).

---

## 4. Correspondance avec la roadmap PRD

| Étape | Phase PRD |
|---|---|
| 1, 2 | 0 et 2 (partie locale), 3 (calendrier) |
| 3 | 1 |
| 4 | 3 et 5 (NOT-04, NOT-05) |
| 5, 6 | 4 |
| 7, 8 | 5 |
| 9 | transversale ; finalisée avant la bêta |
| 10 | 6 |

Ordre conseillé : **1 → 2 → 3 → 6 (socle) → 4 → 5 → 7 → 8**, avec l'étape 9 à chaque étape. La modération passe avant l'ouverture du social : rien n'est publié par des utilisateurs avant qu'elle fonctionne.
