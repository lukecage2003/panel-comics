# Stabilisation — Étape H : rapport final (15 livrables)

Date : 17 novembre 2026. Référence : « PANEL — MASTER PROMPT 2.0 : audit global, sécurisation, stabilisation et évolution ».
Base de départ : commit `7cb25c3`. Fin : voir l'historique Git (commits `a8a9080` → étape H), tous **locaux** : aucun push, aucun déploiement.
Détail problème par problème : [`00-diagnostic.md`](00-diagnostic.md). Décisions : `docs/DECISIONS.md`, D-85 à D-90.

Statuts : **Corrigé et vérifié** · **Corrigé mais insuffisamment vérifié** · **Identifié mais non corrigé** · **Non testable dans l'environnement actuel**.
Aucune nouvelle fonctionnalité n'a été ajoutée ; aucune capacité utile n'a été retirée ; aucune donnée réelle n'a été modifiée (tests sur `localhost:8097` avec des données fictives restaurées ; `localhost:8085` jamais rechargé).

## 1. Audit

| Élément | Constat |
|---|---|
| Application | `index.html` unique (≈ 23 200 lignes, 1,90 Mo), 3 scripts en ligne, 25 modules purs `domains/` (24 au départ + `localDate`) |
| Architecture | Interface → modules purs (`window.PanelDomains`) ; frontières contrôlées (`check-boundaries --strict` : 0 couplage) ; relais local `serve.js` ; service worker ; application Android (Capacitor) ; compte en ligne préparé, inactif |
| Problèmes relevés | 8 de sécurité (S1–S8), 6 de fiabilité (F1–F6), 5 d'interface (D1–D5), 5 UX/responsive (U1–U5), 1 de mouvement (E1), 3 de performance (G1–G3) |
| Corrigés et vérifiés | S2, S6, S7, F1, F4 (test 62), F5, F6, D1–D5, U1, U2, U3, E1, G1–G3 |
| Corrigé mais insuffisamment vérifié | S1 (Android : APK ni recompilé ni installé) |
| Identifiés mais non corrigés | S3 (atténué), S4, S5, S8, F3, U4 (conforme AA) — voir § 4 |
| Tranché par l'utilisateur | U5 : « Wishlist », « Pull list », « Key Issues » gardés |

## 2. Sécurité

| # | Gravité | Surface | Scénario | Conséquence | Correction | Résultat des tests |
|---|---|---|---|---|---|---|
| S1 | Élevée | Android `allowBackup="true"` | Sauvegarde cloud/ADB restaurée ou extraite | Fuite des identifiants Metron, de la clé Comic Vine | `allowBackup="false"`, `fullBackupContent="false"`, `data_extraction_rules.xml` excluant tout (cloud et transfert) | **Corrigé mais insuffisamment vérifié** : construction `www/` réussie ; APK non recompilé ni installé (non testable ici) |
| S2 | Moyenne | Mot de passe Metron en clair dans `localStorage` | XSS ou accès au profil | Vol du mot de passe | Mot de passe en `sessionStorage` seulement, migration de l'ancien format, message dans Réglages | **Corrigé et vérifié** : migration testée sur 8097 (identifiants fictifs) ; test Edge 21 |
| S3 | Moyenne | 138 `innerHTML` | Donnée externe non échappée | XSS | Atténué : CSP stricte, `escapeHtml`, tests XSS existants | Identifié mais non corrigé (atténué) |
| S4 | Faible | JSONP Comic Vine autorisé par la CSP | Réponse JSONP falsifiée | Exécution de script | Passer par le relais JSON de `serve.js` | Identifié mais non corrigé |
| S5 | Faible | `connect-src https:` large | Exfiltration après XSS | Fuite | Restreindre la liste une fois figée | Identifié mais non corrigé |
| S6 | Faible | JSZip et zxing depuis des CDN | CDN compromis | Script malveillant | Copies figées dans `vendor/`, identiques au registre npm (empreintes dans `vendor/README.md`) ; plus aucun CDN dans la CSP | **Corrigé et vérifié** : 0 requête CDN, 0 violation CSP, zip et décodage UPC-A + EAN-5 réussis |
| S7 | Faible | Gestionnaire en ligne réintroduit | Bouton cassé par `script-src-attr 'none'` | Régression | `scripts/csp.js` échoue si `onclick=`, `onerror=`… réapparaît | **Corrigé et vérifié** (3 détections, 0 faux positif) |
| S8 | Faible | Dépendances de construction Android (3 alertes modérées) | Outil de build seulement | Aucune à l'exécution | Montée de Capacitor | Identifié mais non corrigé |
| — | — | Secrets | `check:secrets` sur les 261 fichiers suivis | — | Exception étroite pour le lecteur zxing figé (code compilé) | 0 correspondance |

## 3. Bugs corrigés

| # | Bug | Correction | Test de non-régression |
|---|---|---|---|
| F1 | Date « du jour » en UTC (veille entre 0 h et 1–2 h en France, 5 h au Québec) : 13 dates + 2 clés de mois | Module `local-date.js` (`todayLocal`, mois locaux) | 6 tests Node à fuseaux imposés + garde-fou statique ; test Edge 67 (horloge à 0 h 30) |
| F4 | Test 62 en échec dans la suite (état laissé par le test 61) | Départ propre du test 62 | Test 62 : 16/16 |
| D1 | Actualités manga dans Explorer (contraire à D-12) | `newsCore.inScope`, puce « Manga » retirée | Test Node `inScope`, test Edge 68 |
| D3 | Wishlist titrée « Ma collection », Pull list titrée « Calendrier », nav non resynchronisée | `syncSinglesNav` | Test Edge 68 |
| D5 | Boutons rendus `listitem` (rôle perdu) | `role="group"` nommé | Test Edge 68 |
| U2 | Débordement de 10 px de la vue Lecture à 375 px | Le libellé d'import passe à la ligne | 0 débordement sur 10 vues à 375 px ; test Edge 69 |
| F5 | Fenêtres modales inaccessibles au clavier | Gestionnaire commun des dialogues | Test Edge 70 |
| G3 | Risque hors ligne induit par `Vary` | `ignoreVary` dans `sw.js` | Vérification Edge hors ligne |

## 4. Problèmes restants

| # | Gravité | Problème | Pourquoi non corrigé | Recommandation |
|---|---|---|---|---|
| S1 | Élevée | Android : correction non vérifiée sur appareil | Pas d'APK ni d'appareil ici | Recompiler, installer, vérifier `adb backup` / transfert |
| S3 | Moyenne | 138 `innerHTML` | Revue longue ; risque atténué par la CSP | Revue par lot, `textContent` quand possible |
| S4, S5 | Faible | JSONP Comic Vine ; `connect-src https:` | Changement de flux réseau, hors stabilisation | Relais JSON, liste de domaines |
| S8 | Faible | Dépendances de build Android | Montée de version à part | Lors de la prochaine montée de Capacitor |
| F3 | Faible | Trois `isoDate` homonymes | Sans effet fonctionnel | Renommer lors d'un prochain lot |
| U4 | Faible | Onglets de 30 px | Conforme AA (24 px) | Décision de design (44 px, AAA) |
| — | Faible | `index.html` de 1,9 Mo | Architecture | Découpage avec PANEL 2.0 |
| T1 | Moyenne | Le profil Edge de test persistant bloque des évaluations ; une évaluation bloquée continue et fausse les tests suivants (cascade) | Outillage de test, hors application | Repartir d'un profil neuf à chaque suite ; annuler l'évaluation (ou recharger la page) après un dépassement |
| T2 | Faible | Test 12 : `savedAuto` faux | Antérieur à la stabilisation | Examiner l'attente du test (année de couverture) |
| T3 | Faible | Test 39 : emplacement de démonstration non retiré | Défaut du test | Restaurer les emplacements en fin de test |
| T4 | Faible | Test 61 : suppose un relais Metron et une image chargeable | Dépend de l'environnement | Simuler le relais et utiliser une image `data:` |

## 5. Explorer (UX)

- **Comics uniquement** : actualités seulement manga masquées à l'affichage (flux inchangé), articles qui relient manga et univers comics conservés ; sorties hors périmètre déjà masquées (D-37).
- **Explorer et Collection séparés** : Explorer ne fait que lire la Collection (statut possédé, compteurs), conformément à `docs/phase4/02-frontieres-collection-explorer.md` ; 0 couplage.
- Galeries : boutons de nouveau annoncés comme boutons, groupe nommé.
- 375 px : aucun débordement. Sommaire : défilement animé seulement sans « réduire les animations ».

## 6. Calendrier (UX)

- « Sorties & calendrier » (Explorer) et « Pull list » (Collection) ouvrent la même vue, filtrée ou non ; chacune a maintenant son titre, son entrée active et son titre d'onglet, resynchronisés quand on coche ou décoche « Ma pull list seulement ».
- Semaines à venir : boutons accessibles (`role="group"` « Prochaines semaines »).
- Champs de la pull list nommés ; « Ajouté à la pull list », « + Pull list ».
- 375 px : aucun débordement.

## 7. Responsive

- 0 débordement horizontal sur les 10 vues à 375 px (Lecture corrigée) et à 1280 px.
- Effets au survol réservés aux appareils qui survolent (89 règles) ; au toucher, appui visible (échelle 0,97, ou opacité si mouvement réduit) ; flèches des publications visibles au toucher.
- Mouvement réduit : défilements et animations en boucle respectent `prefers-reduced-motion`.
- Garde-fou permanent : `npm run check:motion`.
- Non fait : essai sur un vrai téléphone (simulation 375 px et mode tactile du navigateur seulement).

## 8. Localisation

- Interface en français ; décision de l'utilisateur : « Wishlist », « Pull list » et « Key Issues » gardés.
- Corrigés : « Scanner un code-barres », « Scanner une couverture », « Ajouter un single », « Fiche du single », « Exporter (JSON) », « Scanner », « Paramètres et clés API », « Collection physique », « Key Issue majeure (1re apparition, mort…) », « Toutes les boîtes (short et long boxes) ».
- Gardés (noms propres) : titres d'œuvres, « League of Comic Geeks », « CLZ », « Comic Vine ».
- Date du jour à l'heure locale (F1).

## 9. Accessibilité (WCAG 2.2 AA)

| Critère | Constat | Statut |
|---|---|---|
| 1.3.1 / 4.1.2 Nom, rôle | 11 champs nommés ; 12 dialogues avec rôle, `aria-modal` et nom ; boutons sans rôle `listitem` ; `aria-current` sur la navigation | Corrigé et vérifié |
| 2.1.1 / 2.1.2 Clavier, pas de piège | Tab gardé dans le dialogue ouvert, Échap ferme ; aucun élément cliquable non atteignable | Corrigé et vérifié |
| 2.4.2 Titre de page | « <vue> · Panel » | Corrigé et vérifié |
| 2.4.3 Ordre du focus | Focus déplacé dans le dialogue puis rendu | Corrigé et vérifié |
| 1.4.3 Contraste | Calcul sur le texte des 10 vues : 0 défaut | Vérifié |
| 2.5.8 Taille des cibles | Onglets 30 px ≥ 24 px | Conforme (U4 documenté) |
| 2.3.3 / mouvement réduit | Respecté partout | Corrigé et vérifié |
| — | Non fait : essai avec un vrai lecteur d'écran (NVDA, TalkBack) | Non testable dans l'environnement actuel |

## 10. Performance

| Mesure | Avant | Après |
|---|---|---|
| Poids envoyé (page, zxing, JSZip, atlas…) | 3,38 Mo | 0,93 Mo (−72 %) |
| `index.html` | 1,90 Mo | 0,43 Mo |
| Réouverture sans changement | 1,90 Mo retéléchargés | Réponse 304, 0 octet de contenu |
| Démarrage sur 8097 (collection fictive) | — | Premier octet 61 ms, page prête 445 ms |

Hors ligne vérifié dans Edge après le changement. Non mesuré sur la vraie collection (8085 non rechargé).

## 11. Fichiers modifiés

26 fichiers de `a8a9080` à l'étape G (+ ce rapport) :
`index.html`, `serve.js`, `sw.js`, `run-all-tests.js`, `package.json`, `.gitattributes`, `android-app/build-www.js`, `android-app/android/app/src/main/AndroidManifest.xml`, `android-app/android/app/src/main/res/xml/data_extraction_rules.xml` (nouveau), `domains/catalog/local-date.js` et `.test.js` (nouveaux), `domains/explorer/news-core.js` et `.test.js`, `scripts/csp.js`, `scripts/check-secrets.js`, `scripts/sync-domains.js`, `scripts/check-motion.js` (nouveau), `scripts/serve-static.test.js` (nouveau), `vendor/README.md`, `vendor/jszip-3.10.1.min.js` + licence, `vendor/zxing-wasm-3.1.3/` (lecteur, `.wasm`, licence), `docs/DECISIONS.md`, `docs/stabilisation/00-diagnostic.md` et `01-rapport-final.md` (nouveaux).

## 12. Tests exécutés

**Contrôles statiques et tests Node (tous réussis)**

| Commande | Résultat |
|---|---|
| Syntaxe des 3 scripts en ligne | 0 erreur |
| `node scripts/csp.js` | empreintes à jour, aucun gestionnaire en ligne |
| `npm run check:motion` | 94 règles, 0 problème |
| `npm run check:dead-code` | 2 600 déclarations, 0 inutilisée |
| `node scripts/check-boundaries.js --strict` | 0 couplage |
| `node scripts/sync-domains.js --check` | 25 modules identiques |
| `npm run check:secrets` | 261 fichiers suivis, 0 correspondance |
| `npm run test:domains` | 140/140 |
| `npm run test:db` | 135/135 |
| `npm run test:serve` | 4/4 |

**Suite Edge (`run-all-tests.js`, 70 tests)**

1. *Profil de test habituel (`.edge-test-profile`)* : arrêt au test 24 sur le délai global de 900 s, après 7 évaluations bloquées (tests 8, 14, 15, 18, 19, 22, 23). Le test 21 y échoue aussi : une évaluation bloquée continue de tourner dans la page et perturbe la suivante.
2. *Rejoués seuls (Edge headless, profil neuf, page `file://`)* : 8, 15, 18, 19, 21, 22 et 23 réussissent tous, chacun en moins de 2 s. Le test 21 (S2) donne 11/11. Les blocages viennent donc du profil persistant, pas du code.
3. *Suite complète dans un profil neuf* (même fichier, seul le dossier de profil change) : 70 tests exécutés jusqu'au bout, **58 réussis**, 12 en échec dont 4 dépassements (57, 60, 61, 65). Ce sont les 4 mêmes dépassements que lors de la suite de l'étape A, avant toute modification.
4. *Les 12 échecs, rejoués seuls dans un profil neuf* :

| Test | Rejoué seul | Conclusion |
|---|---|---|
| 57 Social local, 60 Fil, 62 Galerie du direct, 63 Direct et Communauté, 65 Compte en ligne | Réussis | Effet de cascade (évaluation bloquée encore active) |
| 59 Lecture, 66 CSP, 68 Explorer et navigation (D), 70 Dialogues (F) | Réussis | Effet de cascade ; 68 et 70 vérifient les étapes D et F |
| 12 Cote automatique (`savedAuto`) | Échec | **Antérieur** : déjà en échec à l'étape A et dans les journaux D-78. Identifié mais non corrigé |
| 39 Communauté (`finalCollection`) | Échec | **Défaut du test** : le test crée l'emplacement « Boîte secrète » sans le retirer, ce qui ne se voit que dans un profil neuf. Aucune ligne de code des emplacements n'a été modifiée pendant la stabilisation. Identifié mais non corrigé |
| 61 Studio de direct (`shown`, `variants`) | Échec | **Dépend de l'environnement** : en `file://`, aucun relais Metron n'est configuré, donc aucune variante ; l'image `example.invalid` ne se charge pas. Ce test n'a jamais réussi dans les journaux disponibles (dépassement à l'étape A). Code Metron et direct non modifiés hors S2. Identifié mais non corrigé |

Bilan : **aucune régression attribuable à la stabilisation n'a été trouvée.** Trois défauts de test ou d'environnement sont documentés ; ils existaient déjà avant les étapes B à G.

**Vérifications ponctuelles**
- Sur 8097 (données fictives restaurées) : connexion Metron S2 et migration de l'ancien format, navigation, 10 vues à 375 px, dialogues, clavier, contraste.
- Dans un Edge headless au profil temporaire : service worker, cache et rechargement hors ligne (étape G).

## 13. Risques résiduels

1. **Android** : la protection des sauvegardes (S1) n'est prouvée que par le manifeste ; un APK de test doit le confirmer.
2. **XSS** : 138 `innerHTML` restent ; la CSP stricte (aucun script en ligne non haché, aucun gestionnaire en ligne, aucun CDN) limite fortement l'impact.
3. **Réseau** : JSONP Comic Vine et `connect-src https:` (S4, S5).
4. **Suite Edge** : pas de passage « tout vert » d'un seul tenant. Chaque échec a été rejoué seul : 58 tests réussissent dans la suite, 9 de plus réussissent seuls, et 3 défauts de test ou d'environnement antérieurs restent (T2 à T4). Une régression qui ne se montrerait que dans l'enchaînement complet ne peut donc pas être totalement exclue.
5. **Mobile réel et lecteur d'écran** : vérifiés en simulation seulement.
6. **Mise à jour du service worker** : 8085 proposera « Recharger » (nouvelle version) ; aucune donnée n'est touchée.

## 14. Préparation PANEL 2.0

- Base assainie : CSP sans CDN, bibliothèques figées et vérifiées, dates locales centralisées, frontières de domaines vérifiées automatiquement, garde-fous permanents (`check:secrets`, `check:dead-code`, `check-boundaries`, `sync-domains --check`, `csp`, `check:motion`, `test:serve`).
- Déjà présent et conservé : noyaux Source/Edition Intelligence (D-81), compte en ligne préparé sur préproduction (D-82, D-84, inactif).
- Modules PANEL 2.0 : **documentés seulement** (`docs/panel-2/`), non implémentés ; PANEL ATLAS abandonné (aucun code).
- Prérequis recommandés avant d'implémenter : découpage d'`index.html` en modules chargés à la demande ; S4/S5 ; APK de test (S1) ; décision DR-08 (production).

## 15. Recommandations

1. Recompiler et installer l'APK de test pour valider S1 (priorité haute).
2. Fiabiliser la suite Edge : un profil neuf à chaque exécution et l'arrêt d'une évaluation bloquée (T1) ; corriger les tests 12, 39 et 61 (T2 à T4).
3. Faire un essai sur un vrai téléphone et avec NVDA / TalkBack (dialogues, navigation).
4. Remplacer le JSONP Comic Vine par le relais JSON, puis restreindre `connect-src` (S4, S5).
5. Poursuivre la revue des `innerHTML` par lots (S3).
6. Planifier le découpage d'`index.html` comme premier lot technique de PANEL 2.0.
7. Garder l'ordre : aucun module PANEL 2.0 avant ces points et la décision DR-08.
