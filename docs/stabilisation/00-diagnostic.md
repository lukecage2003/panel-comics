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
| S1 | Élevée | Android `allowBackup="true"` | Sauvegarde Google/ADB de l'application restaurée sur un autre appareil ou extraite | Fuite des identifiants Metron, de la clé Comic Vine et, plus tard, du jeton de session | `allowBackup="false"` ou règles `dataExtractionRules` excluant le stockage web | Identifié mais non corrigé — **décision de l'utilisateur requise** (change le comportement de sauvegarde) |
| S2 | Moyenne | `localStorage.panel_metron_creds` (mot de passe en clair) | Script injecté (XSS) ou accès physique au profil du navigateur | Vol du mot de passe Metron | Ne garder que pour la session (sessionStorage) ou chiffrer avec une clé non stockée ; avertir dans Réglages | Identifié mais non corrigé — décision requise (l'utilisateur devrait ressaisir le mot de passe) |
| S3 | Moyenne | 138 affectations `innerHTML` | Donnée externe non échappée (titre d'API) | XSS | Atténué : CSP stricte (D-83) + `escapeHtml` (313 usages) + tests XSS existants ; poursuivre la revue par lot | Identifié mais non corrigé (atténué) |
| S4 | Faible | CSP `script-src https://comicvine.gamespot.com/api/` (JSONP) | Réponse JSONP compromise ou falsifiée | Exécution de script dans la page | Passer par le relais `serve.js` (JSON) au lieu du JSONP | Identifié mais non corrigé |
| S5 | Faible | CSP `connect-src https:` large | Exfiltration après XSS | Fuite de données | Restreindre aux domaines utilisés une fois la liste figée | Identifié mais non corrigé |
| S6 | Faible | JSZip et zxing chargés depuis des CDN sur le Web | CDN compromis (versions figées, adresses exactes) | Script malveillant | Copier dans `vendor/` comme supabase-js (D-84) | Identifié mais non corrigé |
| S7 | Faible | Gestionnaire en ligne réintroduit par erreur | Bouton cassé silencieusement par `script-src-attr 'none'` | Régression fonctionnelle | Garde-fou ajouté à `scripts/csp.js` (échec de la vérification) | **Corrigé et vérifié** (test unitaire du détecteur : 3 détections / 0 faux positif) |
| S8 | Faible | Dépendances Android (`@capacitor/cli → xcode → uuid`, 3 modérées) | Outil de construction seulement, non embarqué | Aucune au moment de l'exécution | Mise à jour lors de la prochaine montée de Capacitor | Identifié mais non corrigé |
| — | — | Dépendances racine | `npm audit` : 0 vulnérabilité | — | — | Vérifié |
| — | — | Supabase préproduction | RLS active, conseillers : 5 INFO (tables réservées au service) | — | — | Vérifié |
| — | — | Secrets dans le dépôt | `check:secrets` : 0 ; `.secrets/` et `.cache/` ignorés | — | — | Vérifié |

## 6. Principaux problèmes de fiabilité

| # | Gravité | Problème | Détail | Statut |
|---|---|---|---|---|
| F1 | Élevée | Date « du jour » calculée en UTC | `new Date().toISOString().slice(0, 10)` donne la date UTC : entre 0 h et 1 h (France, 2 h l'été) la date d'achat, de cession, « aujourd'hui » du calendrier et les noms d'export sont ceux de la veille ; jusqu'à 5 h au Québec. 13 occurrences (lignes ≈ 8921, 8980, 12001, 12072, 12231, 12247, 19724, 20521, 20537, 20549, 21625, 22359, 22617) | Identifié mais non corrigé — étape C |
| F2 | Moyenne | Suite Edge complète lente / blocages IndexedDB sur cette machine | Historique de blocages ; contournée par exécution ciblée dans le navigateur | Non testable dans l'environnement actuel (partiellement) |
| F3 | Faible | Trois `isoDate` homonymes à portées différentes | Lignes 4991, 5791 (validation), 13333 (formatage local) : risque de confusion lors des corrections | Identifié mais non corrigé |

## 7. Problèmes UX et responsive

| # | Gravité | Problème | Statut |
|---|---|---|---|
| U1 | Élevée | Animations « réservées au bureau » : 95 règles `:hover`, 0 garde `@media (hover: hover)` ; sur mobile les effets ne se déclenchent pas ou restent collés après un toucher | Identifié mais non corrigé — étape E |
| U2 | Moyenne | Vue Lecture à 375 px : débordement horizontal de 11 px (coupable non isolé : probablement pseudo-élément ou transformation) | Identifié mais non corrigé |
| U3 | Moyenne | 8 champs sans libellé accessible : `globalSearch`, `singlesSearchInput`, `singlesSortSelect`, `exSearch`, `pullManSeries`, `pullManIssue`, `seriesTrackSearch`, `seriesTrackSort` | Identifié mais non corrigé — étape F |
| U4 | Faible | Onglets de 30 px de haut sur mobile (WCAG 2.2 AA 24 px respecté, en dessous des 44 px recommandés) | Identifié mais non corrigé |
| U5 | Faible | « Wishlist », « Pull List » en anglais | Identifié — terminologie à trancher (étape F) |
| — | — | `lang="fr"`, un seul `h1`, 0 image sans `alt`, 0 bouton sans nom, 0 erreur d'initialisation, aucun débordement à 1280 px, 17 règles `prefers-reduced-motion` | Vérifié |

## 8. Plan de travail priorisé

1. **B — Sécurité** : S7 fait ; S1 et S2 sur décision ; S6 (copie locale de JSZip/zxing) ; S4/S5 documentés.
2. **C — Fiabilité** : F1 (fonction de date locale unique + test de non-régression à minuit), F3.
3. **D — Interface** : Explorer, calendrier, navigation, cohérence visuelle (sans retrait de capacité).
4. **E — Responsive et animations** : U1 (gardes `hover`, équivalents tactiles), U2, mouvement réduit.
5. **F — Français et accessibilité WCAG 2.2 AA** : U3, U4, U5, clavier et focus.
6. **G — Performance** : compression gzip/brotli dans `serve.js` (1,84 Mo envoyés sans compression), chargement différé.
7. **H — Validation finale** : suite complète, 15 livrables.
