# PANEL 2.0 — Stratégie d'intelligence artificielle

L'IA est un **outil d'assistance**, jamais une source de vérité. Toute sortie d'IA qui touche une donnée documentaire devient au mieux une **proposition** (`catalog.claim` en statut `noted`, `kind = hypothesis`), soumise aux mêmes revues humaines que les contributions (voir Source).

## 1. Ce que PANEL fait déjà sans IA payante

| Capacité | Méthode existante | Preuve |
|---|---|---|
| Reconnaître une couverture | Empreinte dHash et similarité, sur l'appareil | `index.html`, tests 4 et 5 |
| Identifier un numéro | Code-barres 17 chiffres, ISBN, recherche GCD et Metron | tests 2, 19, 20 |
| Recherche tolérante | Normalisation des accents, fautes, inversions | `catalog-core.js`, test 38 |
| Doublons probables | Détection signalée, jamais fusionnée | alerte « Doublons probables signalés (jamais fusionnés) » de « Vérifier les données » |
| Apprentissage des préférences d'actualités | Pondération locale avec demi-vie de 30 jours | `news-core.js` (D-75) |

Règle : **ces fonctions essentielles restent disponibles sans IA payante**. L'IA s'ajoute, elle ne remplace pas.

## 2. Cas d'utilisation

| Cas | Données nécessaires | Résultat attendu | Risques d'erreur | Vérification humaine | Coût potentiel | Exécution locale | Dépendances externes |
|---|---|---|---|---|---|---|---|
| Identification d'éditions | Photo de couverture, code-barres, ISBN, métadonnées du catalogue | 1 à 3 éditions candidates avec score | Variantes proches, rééditions identiques | L'utilisateur choisit ; rien n'est rattaché d'office | Faible (dHash) ; moyen avec un modèle de vision | Oui (dHash, pHash existants) | Aucune obligatoire |
| Détection de doublons du catalogue | Titres normalisés, dates, identifiants externes | Paires suspectes | Faux positifs (séries homonymes, volumes) | Fusion par un vérificateur, avec alias (`catalog.alias`) | Faible | Oui (`pg_trgm`, règles) | Aucune |
| Extraction d'informations documentaires | Texte d'une source autorisée (page web publique, notice BnF) | Affirmations candidates avec citation | Hallucination, mauvaise attribution | Revue Source obligatoire ; la citation doit exister mot pour mot dans la source | Moyen (LLM) | Partielle (petits modèles locaux, qualité moindre) | LLM optionnel |
| Comparaison d'éditions | Contenus (`edition_content`), pagination | Différences de contenu | Données incomplètes présentées comme différences | Affichage « d'après les données connues » ; validation contributeur | Faible (calcul) | Oui | Aucune |
| Aide à la classification | Fiche, mots-clés | Proposition de continuité, d'événement, de genre | Erreur de continuité | Revue Source | Faible à moyen | Oui (règles) / LLM optionnel | LLM optionnel |
| Détection de contradictions | Affirmations sur un même sujet | Paires en conflit, nature probable | Faux conflit (différence de traduction) | Un vérificateur qualifie le `claim_conflict` | Faible | Oui (comparaison structurée) | Aucune |
| Assistance à la recherche (Lab) | Dossier, sources du dossier | Pistes, sources à consulter | Pistes inventées | Toute piste est marquée « suggestion IA » ; aucune preuve créée par l'IA | Moyen | Partielle | LLM optionnel |
| Synthèse de débats | Arguments et votes d'un débat clos | Projet de synthèse | Biais, omission d'un camp | Le modérateur ou l'auteur valide et signe la synthèse | Moyen | Partielle | LLM optionnel |
| Aide à la vérification de sources | URL ou référence citée | Vérifier que la citation existe, que le lien répond | Page modifiée depuis | Le contributeur confirme | Faible | Oui (téléchargement et recherche de texte) | Accès réseau |
| Analyse de tendances (Signal) | Agrégats anonymes | Évolutions significatives | Sur-interprétation d'un petit échantillon | Seuils statistiques, étiquette « observé sur PANEL » | Faible | Oui (statistiques classiques) | Aucune |

## 3. Architecture

```
Client (index.html)  ──>  Edge Function « assist » (facultative, quotas)  ──>  fournisseur d'IA choisi (DR-05)
        │                         │
        │                         └─ écrit uniquement des propositions (claim noted / hypothesis), jamais un fait
        └─ fonctions locales : dHash, normalisation, règles, statistiques (toujours disponibles)
```

- **Point d'entrée unique** : une Edge Function, pour garder les clés côté serveur (comme le relais `serve.js` aujourd'hui) et appliquer des quotas (`app.service_limits`).
- **Désactivable** : si l'IA est coupée, l'application fonctionne entièrement.
- **Traçabilité** : chaque proposition d'IA enregistre le modèle, la date et les entrées (sans donnée personnelle).

## 4. Règles

1. Aucune ingestion de scans de comics, aucune redistribution d'images ou de pages protégées.
2. Aucune donnée personnelle (collection, notes, emplacements, prix) envoyée à un fournisseur d'IA.
3. Une citation produite par l'IA doit exister mot pour mot dans la source : sinon, la proposition est rejetée automatiquement.
4. L'IA ne vote pas, ne valide pas, n'accumule pas de réputation.
5. Les fonctions Premium d'IA (si elles existent) ne doivent jamais conditionner l'accès à une information vérifiée.

## 5. Coûts et risques

| Poste | Estimation | Hypothèse |
|---|---|---|
| Fonctions locales | Nul en coût variable | Calcul sur l'appareil ou en SQL |
| Extraction et synthèses par LLM | Inconnu tant que le fournisseur n'est pas choisi | Facturation au volume de texte ; à plafonner par quota mensuel |
| Modèle local sur serveur | Coût de calcul (GPU) à estimer | Pertinent seulement au-delà d'un volume important |

Risque principal : **la crédibilité**. Une seule erreur d'IA présentée comme un fait vérifié annule la promesse de Source. D'où la règle : jamais de fait sans revue humaine.
