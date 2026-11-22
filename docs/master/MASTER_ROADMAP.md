# MASTER ROADMAP — Panel

Date : 22 novembre 2026 (D-111). **Document central.** Il ordonne tout le reste ; les autres documents de `docs/master/` le détaillent et renvoient aux documents existants au lieu de les recopier.

> **Idée du projet (invariante)** : Panel est l'application des collectionneurs de **comics** (pas de manga). La **collection est au cœur** : c'est l'identité du membre. Autour d'elle, un réseau social comics (fil, pensées, directs, rencontres) et un Découvrir encyclopédique. Tout fonctionne d'abord **sur l'appareil**, hors ligne ; le compte en ligne est facultatif et reste fermé tant que l'utilisateur ne l'ouvre pas (S8).

## Carte des documents

| Document | Rôle | S'appuie sur (existant) |
|---|---|---|
| [CURRENT_STATE_AUDIT.md](CURRENT_STATE_AUDIT.md) | État réel du code au 22/11/2026, statut par module | [directeur/01](../directeur/01-etat-des-lieux-et-audit.md), [panel-2 audit (14/11)](../panel-2/PANEL_2_REPOSITORY_AUDIT.md) |
| [PRODUCT_ARCHITECTURE.md](PRODUCT_ARCHITECTURE.md) | Modules, frontières, flux de données | [prd/TECHNICAL_ARCHITECTURE](../prd/PANEL_TECHNICAL_ARCHITECTURE.md), [domains/README](../../domains/README.md) |
| [FEATURE_CATALOG.md](FEATURE_CATALOG.md) | Fiche par module : statut, priorité, décision | [prd/FUNCTIONAL_SPECIFICATIONS](../prd/PANEL_FUNCTIONAL_SPECIFICATIONS.md) |
| [BUSINESS_MODEL.md](BUSINESS_MODEL.md) | Comment Panel pourrait vivre, sans trahir les membres | [directeur/13](../directeur/13-monetisation-musique-suite.md), [panel-2 BUSINESS_MODEL](../panel-2/PANEL_2_BUSINESS_MODEL.md) |
| [FINANCIAL_MODEL.md](FINANCIAL_MODEL.md) | 6 scénarios à hypothèses explicites | — (nouveau) |
| [TECHNICAL_ROADMAP.md](TECHNICAL_ROADMAP.md) | Ordre technique des lots | [ROADMAP.md](../ROADMAP.md), [directeur/12](../directeur/12-s8-comptes-en-ligne.md) |
| [SECURITY_AND_COMPLIANCE.md](SECURITY_AND_COMPLIANCE.md) | Matrice légale BE/UE, Panel Guardian, squelettes juridiques | [prd/SECURITY_AND_COMPLIANCE](../prd/PANEL_SECURITY_AND_COMPLIANCE.md) |
| [DATA_GOVERNANCE.md](DATA_GOVERNANCE.md) | Données, provenance, licences, conservation | [panel-2 DATA_ARCHITECTURE](../panel-2/PANEL_2_DATA_ARCHITECTURE.md) |
| [RISKS_AND_DEPENDENCIES.md](RISKS_AND_DEPENDENCIES.md) | Risques, dépendances, déclencheurs | — |
| [DECISIONS_LOG.md](DECISIONS_LOG.md) | Index des décisions | [DECISIONS.md](../DECISIONS.md) (source unique) |

## Échelle de priorité

- **P0** : bloque l'ouverture des comptes en ligne ou expose un mineur, une donnée ou un droit d'auteur.
- **P1** : nécessaire au lancement public.
- **P2** : utile après le lancement.
- **P3** : confort.
- **RESEARCH** : à étudier avant de décider.
- **DEFERRED** : volontairement repoussé, avec sa condition de reprise.

## Étapes hiérarchisées

### Étape A — Socle local (fait)

La collection, la Wishlist, la Pull list, les Key Issues, les sorties, la lecture, Découvrir et le fil local fonctionnent sur l'appareil.

Couverture actuelle :
- tests de domaines : 219 ;
- base de données : 172 (PGlite) ;
- parcours d'écran : 84 (Edge).

Décision : **Conservée**.

### Étape B — Gouvernance et Guardian (P0, préparé le 22/11/2026, D-111)

1. **Migration 18 `panel_guardian`** — faite et testée localement, **non appliquée** :
   - statut d'âge contestable ;
   - lien parental par code à usage unique ;
   - réglages du parent ;
   - restrictions de compte ;
   - politique appliquée par des déclencheurs.
2. **Documents de référence** `docs/master/` — faits.
3. **Squelettes juridiques** — faits. Ils portent des `[À COMPLÉTER]` et doivent être validés par un avocat belge (voir [SECURITY_AND_COMPLIANCE](SECURITY_AND_COMPLIANCE.md)).
4. **Mentions** : l'avis d'âge et la note de non-affiliation sont affichés dans l'application (Légal & sécurité).
5. **Module client Guardian** (D-112) : `domains/community/guardian-core.js` et encadré dans Compte & profil, prêts pour l'ouverture des comptes.

### Étape C — Avant l'ouverture des comptes (P0, sur accord de l'utilisateur)

1. Identité légale de l'éditeur, adresse, numéro d'entreprise BCE `[À COMPLÉTER]`.
2. CGU, politique de confidentialité et règles de la communauté validées par un avocat.
3. Analyse d'impact (AIPD) sur le traitement des données de mineurs, avec avocat ou DPO.
4. Application des migrations 13 à 19 en préproduction, puis tests réels.
   - Aucun service distant n'est validé tant que ce n'est pas fait.
5. Équipe de modération humaine, en double authentification, avec délais de réponse écrits.
6. Point de contact DSA et procédure de signalement et de recours publiés.

### Étape D — Lancement restreint (P1)

1. Beta sur invitation, adultes d'abord ; mineurs seulement après validation de Guardian en conditions réelles.
2. Boutiques partenaires pilotes : aucune n'est contactée aujourd'hui.
3. Mesures de qualité :
   - signalements traités dans le délai ;
   - appels ;
   - taux de faux positifs.

### Étape E — Croissance (P2)

- Panel+ (confort seulement).
- Fiches « Boutique vérifiée ».
- Affiliation clairement marquée.
- Écosystème pro : créateurs, éditeurs, boutiques et studios, avec le sceau Encré posé par l'équipe (D-113).
- Le Marché : ouverture après choix d'un prestataire de paiement agréé, avis d'avocat (DSA, Omnibus, DAC7, DSP2) et fixation du pourcentage.
- Messages privés chiffrés pour les adultes, après AIPD.
- Le Comptoir en ligne.

### Étape F — Plus tard

| Sujet | Statut | Condition |
|---|---|---|
| Diffusion audio et vidéo réelle des directs | DEFERRED | Serveur média, coût, modération en temps réel |
| Musique de catalogue | DEFERRED | Licence écrite |
| Preuve d'âge par un prestataire | RESEARCH | Solution conforme RGPD, sans biométrie imposée |
| Application native | RESEARCH | — |

## Critères de sortie de chaque étape

- **B** : migration 18 testée (11 tests Guardian) ; documents liés ; aucune mention de l'ancien nom hors règles de retrait.
- **C** : CGU et politique signées par l'éditeur ; AIPD faite ; migrations appliquées en préproduction ; tests de bout en bout sur la base réelle ; 2 modérateurs en double authentification.
- **D** : 30 jours de beta sans incident grave non traité ; délai médian de traitement des signalements écrit et tenu.
- **E** : revenus réels qui couvrent l'hébergement, mesurés et non projetés.

## Ce qui ne change pas

- Aucun rachat de visibilité.
- Aucune vente de données.
- Aucune publicité pour les mineurs.
- Aucun faux membre, faux vote ou faux abonné.
- La collection reste gratuite et complète.
