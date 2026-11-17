# Stabilisation — Étape A : diagnostic priorisé

Date : 16 novembre 2026. Référence : « PANEL — MASTER PROMPT 2.0 : audit global, sécurisation, stabilisation ».
Base : commit `7cb25c3` (branche `main`, arbre propre). Ce document complète les audits existants sans les répéter :
`docs/directeur/01-etat-des-lieux-et-audit.md`, `docs/panel-2/PANEL_2_REPOSITORY_AUDIT.md`, `docs/phase3/01-audit-technique.md`,
`docs/phase3/09-audit-cloture-lot-3.1.md`.

Statuts utilisés : **Corrigé et vérifié** · **Corrigé mais insuffisamment vérifié** · **Identifié mais non corrigé** · **Non testable dans l'environnement actuel**.
Gravités : Critique · Élevée · Moyenne · Faible.

## 1. État réel du projet

| Élément | Constat (mesuré) |
|---|---|
| Dépôt | Une branche `main`, 90 commits, aucun stash, aucun dépôt distant poussé pendant cette session |
| Application | `index.html` unique (23 144 lignes, ≈ 1,84 Mo), JavaScript sans framework, 3 scripts en ligne |
| Modules purs | 24 modules `domains/*/*.js` (catalog, collection, community, explorer, reading, releases, source, account), intégrés par `scripts/sync-domains.js` |
| Données | IndexedDB + localStorage dans le navigateur ; aucune donnée utilisateur sur un serveur |
| Serveur local | `serve.js` (Node, `127.0.0.1` seulement, contrôle de l'en-tête Host, limite 300 req/min sur `/api`, en-têtes de sécurité) |
| Android | `android-app/` (Capacitor), `build-www.js` recalcule la CSP sur la copie |
| En ligne | Projet Supabase de préproduction (Paris), 13 migrations, RLS vérifiée, 0 compte ; production reportée (DR-08) |
| Contrôles automatiques | `test:domains` 133 ✓, `test:db` 135 ✓, `check:secrets` 0, `check:dead-code` ✓, `check-boundaries --strict` ✓, `sync-domains --check` (CSP comprise) ✓ |
| Suite Edge (66 tests de l'interface) | Relancée intégralement pendant l'audit (résultat consigné dans le rapport final) |

## 2. Architecture

- **Couche interface** : `index.html` — vues Collection, Sorties (calendrier), Pull List, Wishlist, Lecture, Séries, Stats, Finances, Communauté, Explorer ; modales Réglages (onglets), fiche publication, scanner.
- **Couche domaine** : fonctions pures sans DOM ni réseau, testées sous Node, exposées par `window.PanelDomains.<nom>` ; frontières contrôlées par `scripts/check-boundaries.js`.
- **Sources externes** : Metron (identifiants personnels de l'utilisateur), Comic Vine (clé personnelle, JSONP), GCD/agrégateurs via `serve.js` (`/api`), OpenStreetMap (carte en iframe).
- **Sécurité navigateur** : CSP stricte en `<meta>` (D-83) — scripts par empreinte, `script-src-attr 'none'`, aucun gestionnaire en ligne.
- **Hors ligne** : service worker `sw.js` (version `panel-2026-11-16-supabase-js-d84`).
- **Compte en ligne** : préparé (D-82/D-84), inactif tant qu'aucun projet n'est enregistré dans Réglages.

## 3. Fonctionnalités existantes (non exhaustif, toutes conservées)

Collection de comics (numéros, séries, variantes, état, prix, achat, cession), scanner de codes-barres (zxing-wasm), import/export (JSON, CSV, ZIP via JSZip), calendrier des sorties, Pull List, Wishlist, suivi de lecture, statistiques, finances, communauté locale, Explorer (comics uniquement), fiche publication avec niveaux Œuvre/Édition/Exemplaire et correspondances (D-81), sauvegardes et restauration, réglages multi-onglets, application Android.

## 4. Travaux PANEL 2.0 déjà présents

| Module | État |
|---|---|
| Source Intelligence / Edition Intelligence | Noyaux purs `edition-core.js` + affichage dans la fiche (D-81), sans service externe |
| Compte en ligne | Préparé sur préproduction (D-82, D-84), aucune donnée envoyée |
| Autres modules PANEL 2.0 | Documentés seulement (`docs/panel-2/`), **non implémentés** — conformément au master prompt |
| PANEL ATLAS | Abandonné : aucun code du module PANEL 2.0 « ATLAS » (recherche dans `index.html`, `domains/`, tests). À ne pas confondre avec l'« atlas cosmique » de l'Explorer (D-75, 301 fiches servies par le relais, test 56), fonctionnalité existante conservée |

## 5. Risques de sécurité identifiés

| # | Gravité | Surface | Scénario d'exploitation | Conséquence | Correction recommandée | Statut |
|---|---|---|---|---|---|---|
| S1 | Élevée | Android `allowBackup="true"` | Sauvegarde Google/ADB de l'application restaurée sur un autre appareil ou extraite | Fuite des identifiants Metron, de la clé Comic Vine et, plus tard, du jeton de session | `allowBackup="false"` ou règles `dataExtractionRules` excluant le stockage web | **Corrigé mais insuffisamment vérifié** (D-85) : manifeste et règles d'extraction modifiés, construction `www/` vérifiée ; l'APK n'a pas été recompilé ni installé sur un appareil (non testable ici) |
| S2 | Moyenne | `localStorage.panel_metron_creds` (mot de passe en clair) | Script injecté (XSS) ou accès physique au profil du navigateur | Vol du mot de passe Metron | Ne garder que pour la session (sessionStorage) ou chiffrer avec une clé non stockée ; avertir dans Réglages | **Corrigé et vérifié** (D-85) : mot de passe en `sessionStorage` seulement, migration de l'ancien format vérifiée sur 8097 avec des identifiants fictifs ; test Edge 21 complété |
| S3 | Moyenne | 138 affectations `innerHTML` | Donnée externe non échappée (titre d'API) | XSS | Atténué : CSP stricte (D-83) + `escapeHtml` (313 usages) + tests XSS existants ; poursuivre la revue par lot | Identifié mais non corrigé (atténué) |
| S4 | Faible | CSP `script-src https://comicvine.gamespot.com/api/` (JSONP) | Réponse JSONP compromise ou falsifiée | Exécution de script dans la page | Passer par le relais `serve.js` (JSON) au lieu du JSONP | Identifié mais non corrigé |
| S5 | Faible | CSP `connect-src https:` large | Exfiltration après XSS | Fuite de données | Restreindre aux domaines utilisés une fois la liste figée | Identifié mais non corrigé |
| S6 | Faible | JSZip et zxing chargés depuis des CDN sur le Web | CDN compromis (versions figées, adresses exactes) | Script malveillant | Copier dans `vendor/` comme supabase-js (D-84) | **Corrigé et vérifié** (D-85) : fichiers identiques au registre npm, scanner et import vérifiés sur 8097, 0 requête CDN, 0 violation CSP |
| S7 | Faible | Gestionnaire en ligne réintroduit par erreur | Bouton cassé silencieusement par `script-src-attr 'none'` | Régression fonctionnelle | Garde-fou ajouté à `scripts/csp.js` (échec de la vérification) | **Corrigé et vérifié** (test unitaire du détecteur : 3 détections / 0 faux positif) |
| S8 | Faible | Dépendances Android (`@capacitor/cli → xcode → uuid`, 3 modérées) | Outil de construction seulement, non embarqué | Aucune au moment de l'exécution | Mise à jour lors de la prochaine montée de Capacitor | Identifié mais non corrigé |
| — | — | Dépendances racine | `npm audit` : 0 vulnérabilité | — | — | Vérifié |
| — | — | Supabase préproduction | RLS active, conseillers : 5 INFO (tables réservées au service) | — | — | Vérifié |
| — | — | Secrets dans le dépôt | `check:secrets` : 0 ; `.secrets/` et `.cache/` ignorés | — | — | Vérifié |

## 6. Principaux problèmes de fiabilité

| # | Gravité | Problème | Détail | Statut |
|---|---|---|---|---|
| F1 | Élevée | Date « du jour » calculée en UTC | `new Date().toISOString().slice(0, 10)` donne la date UTC : entre 0 h et 1 h (France, 2 h l'été) la date d'achat, de cession, « aujourd'hui » du calendrier et les noms d'export sont ceux de la veille ; jusqu'à 5 h au Québec. 13 occurrences (lignes ≈ 8921, 8980, 12001, 12072, 12231, 12247, 19724, 20521, 20537, 20549, 21625, 22359, 22617) | **Corrigé et vérifié** (D-86) : module `local-date.js`, 13 dates du jour + 2 clés de mois remplacées, 6 tests Node (fuseaux imposés) et test Edge 67 (horloge simulée à 0 h 30) |
| F2 | Moyenne | Suite Edge complète lente / blocages IndexedDB sur cette machine | Historique de blocages ; contournée par exécution ciblée dans le navigateur | Non testable dans l'environnement actuel (partiellement) |
| F3 | Faible | Trois `isoDate` homonymes à portées différentes | Lignes ≈ 4991, 5791 (validation, modules distincts), ≈ 13360 (formatage local) : risque de confusion ; la date du jour passe désormais par `todayLocal()` | Identifié mais non corrigé (sans effet fonctionnel) |
| F4 | Moyenne | Suite Edge d'audit : 4 tests en dépassement de délai (57, 60, 61, 65), test 62 en échec, test 66 non atteint (limite de 15 min) | Test 62 rejoué seul sur 8097 : 16/16 — échec dû à l'état laissé par le test 61 ; départ propre ajouté. Les dépassements relèvent du blocage IndexedDB connu de cette machine | Test 62 : **Corrigé et vérifié** ; 57, 60, 61, 65 : Non testable dans l'environnement actuel (à rejouer à l'étape H) |

## 7. Problèmes UX et responsive

| # | Gravité | Problème | Statut |
|---|---|---|---|
| U1 | Élevée | Animations « réservées au bureau » : 95 règles `:hover`, 0 garde `@media (hover: hover)` ; sur mobile les effets ne se déclenchent pas ou restent collés après un toucher | **Corrigé et vérifié** (D-88) : 89 règles sous `@media (hover: hover)` (16 scindées pour garder `:focus-visible`, `.active`, `.drag`… hors garde), appui visible au toucher (`:active`, réduit à une opacité si mouvement réduit), flèches des publications toujours visibles au toucher ; garde-fou `npm run check:motion` et test Edge 69 ; survol vérifié au bureau, mode tactile vérifié à 375 px |
| U2 | Moyenne | Vue Lecture à 375 px : débordement horizontal de 10 px — cause : bouton « Importer mes lectures (League of Comic Geeks, CLZ, tableur) » en `white-space: nowrap` | **Corrigé et vérifié** (D-88) : le libellé passe à la ligne ; 0 débordement sur les 10 vues à 375 px |
| U3 | Moyenne | 11 champs sans libellé accessible : `globalSearch`, `singlesSearchInput`, `singlesSortSelect`, `exSearch`, `pullManSeries`, `pullManIssue`, `seriesTrackSearch`, `seriesTrackSort`, et (relevés à l'étape D) `releasesPullOnly`, `pullManPublisher`, `pullAddInput` | **Corrigé et vérifié** (D-89) : 11 `aria-label` français (`boxFilterSelect` ajouté ; `releasesPullOnly` est déjà nommé par son libellé englobant) ; test Edge 70 |
| U4 | Faible | Onglets de 30 px de haut sur mobile (WCAG 2.2 AA 2.5.8 : 24 px minimum, respecté ; 44 px recommandés, niveau AAA) | Identifié mais non corrigé — conforme AA, agrandissement laissé à une décision de design |
| U5 | Faible | « Wishlist », « Pull List », « Key Issues » en anglais | **Tranché par l'utilisateur** (17/11/2026) : les trois termes sont gardés ; « Pull List » s'écrit « Pull list » ; tournures et casse autour francisées (D-89) |
| F5 | Élevée | 12 fenêtres modales principales (scanners, fiche, inspecteur, publication, données, guide, emplacements, paramètres, Comic Vine, import, cote) sans rôle de dialogue ni nom ; focus laissé derrière la fenêtre, Tab qui en sort, Échap sans effet, focus non rendu à la fermeture (WCAG 2.1.2, 2.4.3, 4.1.2) | **Corrigé et vérifié** (D-89) : gestionnaire commun (observation de la classe `open`) ; rôle `dialog`, `aria-modal`, nom tiré du titre ; focus sur le dialogue ; Tab et Maj+Tab gardés dedans (volets `<details>` repliés exclus) ; Échap passe par le bouton de fermeture (nettoyages du scanner compris) ; focus rendu ; test Edge 70 |
| F6 | Faible | Libellés à l'anglaise : « Scanner Code-Barres », « Scanner Couverture », « Ajouter un Single (Issue) », « Fiche du Single Issue », « Collection Physique », « Export JSON », « Scan », « Paramètres & Clés API », « 1ère app », « Toutes les Boîtes (Short & Long Boxes) » | **Corrigé et vérifié** (D-89) : casse et tournures françaises (« Scanner un code-barres », « Exporter (JSON) », « 1re apparition »…) ; test Edge 70 |
| D1 | Élevée | Explorer, Actualités : rubrique « Manga » et 4 articles uniquement manga affichés, contraire à D-12 (« comics uniquement, mangas exclus ») | **Corrigé et vérifié** (D-87) : `newsCore.inScope` masque à l'affichage les articles seulement manga (le flux n'est pas modifié), garde ceux qui relient un manga à un univers comics ; plus de puce « Manga » ; test Node + test Edge 68 |
| D2 | Moyenne | Navigation : l'entrée active n'était signalée que visuellement (aucun `aria-current`), barre du bas comprise | **Corrigé et vérifié** (D-87) : `aria-current="page"` sur l'entrée et le bouton de barre actifs ; test Edge 68 |
| D3 | Moyenne | Titres incohérents : Wishlist titrée « Ma collection », Pull List titrée « Calendrier » ; décocher « Ma pull list seulement » laissait Pull List active | **Corrigé et vérifié** (D-87) : titres propres « Wishlist » et « Pull List », synchronisation à chaque changement de la case ; test Edge 68 |
| D4 | Faible | Titre d'onglet identique pour toutes les vues (WCAG 2.4.2) | **Corrigé et vérifié** (D-87) : « <vue> · Panel » |
| D5 | Moyenne | 4 groupes de boutons (semaines à venir du calendrier, boîte à feuilleter, galeries Explorer, « À la une » Communauté) avaient `role="listitem"` : les lecteurs d'écran ne les annonçaient plus comme boutons | **Corrigé et vérifié** (D-87) : conteneurs `role="group"` nommés, boutons natifs ; test Edge 68 |
| E1 | Moyenne | Mouvement réduit incomplet : 10 défilements `behavior: 'smooth'` codés en dur ; la règle globale laissait tourner les animations en boucle (durée 0,01 ms répétée) | **Corrigé et vérifié** (D-88) : `smoothScroll()` respecte `prefers-reduced-motion`, la règle globale ajoute `animation-iteration-count: 1` et `scroll-behavior: auto` ; `check:motion`, test Edge 69 |
| — | — | Étape D, vérifié sans correction : Explorer et calendrier sans débordement à 375 px ; Explorer lit la Collection en lecture seule (statut possédé, compteurs) comme prévu par `02-frontieres-collection-explorer.md`, 0 couplage (`check-boundaries --strict`) ; sorties hors périmètre déjà masquées (D-37) ; aucune capacité retirée | Vérifié |
| — | — | `lang="fr"`, un seul `h1`, 0 image sans `alt`, 0 bouton sans nom, 0 erreur d'initialisation, aucun débordement à 1280 px, 17 règles `prefers-reduced-motion` | Vérifié |

## 8. Plan de travail priorisé

1. **B — Sécurité** : S7 fait ; S1 et S2 sur décision ; S6 (copie locale de JSZip/zxing) ; S4/S5 documentés.
2. **C — Fiabilité** : F1 (fonction de date locale unique + test de non-régression à minuit), F3.
3. **D — Interface** : Explorer, calendrier, navigation, cohérence visuelle (sans retrait de capacité). **Fait (D-87)** : D1 à D5.
4. **E — Responsive et animations** : U1 (gardes `hover`, équivalents tactiles), U2, mouvement réduit. **Fait (D-88)** : U1, U2, E1.
5. **F — Français et accessibilité WCAG 2.2 AA** : U3, U4, U5, clavier et focus. **Fait (D-89)** : U3, U5, F5, F6 ; U4 conforme AA, documenté. Contraste du texte (calcul sur les 10 vues) et éléments cliquables non-boutons : 0 défaut relevé.
6. **G — Performance** : compression gzip/brotli dans `serve.js` (1,84 Mo envoyés sans compression), chargement différé.
7. **H — Validation finale** : suite complète, 15 livrables.
