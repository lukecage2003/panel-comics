# Historique des lots — Panel by Primestone

Relevé du 7 novembre 2026. Chaque référence a été vérifiée avec `git log` : la branche `main` est locale et n'a pas de remote, donc rien n'est poussé.

## Phase 0 — Audit
Audit initial réalisé avant le suivi par Git. Aucun commit ne lui correspond.

## Phase 1 — Stabilisation (clôturée)

| Étape | Commit | Contenu |
|---|---|---|
| 1 à 4 | `3dfa56f` | Point de départ suivi par Git, stabilisation, protection des données |
| 5 | `be3d280` | Retrait de la partie numérique ; les données sont conservées |
| 6 et 7 | `8b04cb3` | Finitions visuelles, DESIGN.md, Android 1.2 |
| — | `7bc4771` | Exclusion des rapports générés du détecteur |

## Phase 2 — Collection, catalogue et découverte (clôturée le 7 novembre 2026)

| Lot | Périmètre | Commit(s) vérifié(s) | Statut |
|---|---|---|---|
| 2.1 | Catalogue normalisé indépendant (IndexedDB `panel-catalog`, provenance, durabilité) | `31a5184`, puis `8823254` (sécurisation : copie IndexedDB atomique, échec de migration sans nouvelle tentative, rapport d'identifiants) | Validé |
| 2.2 | Exemplaires et variantes (normalisation, regroupement, saisie structurée, restauration fidèle) | `0aca044` | Validé |
| 2.3 | Organisation physique : emplacements Pièce → Meuble → Boîte → Séparateur | `1de33e8` | Validé |
| 2.4 | Calendrier international, sorties, Pull List par numéro, Wishlist structurée | `7eae929` | Validé |
| 2.5 | Sources de données, provenance par champ, conflits, import contrôlé (« Data Acquisition & Intelligence Engine ») | `29b9b2a` (DA Primestone livrée juste avant, dans `d36df45`) | Validé |
| 2.6 | Explorer & Reading Guides | `fe19e3c` | Validé le 7 novembre 2026 |

Remarques :
- Le commit `d36df45` est la direction artistique « Primestone » (jaune et noir). Elle a été livrée et validée avec le lot 2.5 ; ce n'est pas un commit fonctionnel du lot 2.5.
- Le lot 2.1 compte deux commits : la livraison, puis la sécurisation.
- Un lot 2.7 avait été envisagé au départ. Il n'a pas été réalisé : la Phase 2 se clôt au lot 2.6, et les sujets restants passent au backlog (voir [`ROADMAP.md`](ROADMAP.md)).

### Validation du lot 2.6
L'utilisateur a réalisé huit contrôles fonctionnels, tous satisfaisants :
1. Recherche globale et pertinence des résultats.
2. Pages éditeurs, personnages, créateurs et séries.
3. Guide King in Black et ses 65 entrées.
4. Filtres Essentiel / Facultatif.
5. Persistance de la progression après fermeture et réouverture.
6. Distinction entre possédé, lu et wishlist.
7. Import et export des guides.
8. Affichage mobile.

### Limites connues à la clôture de la Phase 2 (non transformées en fonctionnalités)
- Le guide King in Black est une **démonstration non exhaustive** relevée auprès d'une seule source.
- Les **sources d'images sous licence** pour les guides restent à identifier.
- Les **correspondances VO/VF** sont en partie non vérifiées (deux éditions Panini sans sommaire confirmé).
- Les **actualités** ne sont pas activées, faute de source ou de CMS.
- **ReadingOrders.com, Comic Compass et French Comics Reading Order** n'ont pas été consultés.
- La clé Comic Vine reste à renouveler. La signature Android de publication, l'option `allowBackup` et la purge des anciennes clés Marvel/Vision sont toujours en attente de décision.

## Plan directeur 2.0 — lot F0 : correctifs des calculs financiers
Autorisé le 7 novembre 2026 (décision D-17), **livré le 8 novembre 2026, en attente de validation**. Spécification : [`directeur/02-audit-financier.md`](directeur/02-audit-financier.md) et backlog B-01 à B-06, B-24, B-25 de [`directeur/04`](directeur/04-backlog-feuille-de-route-decisions.md).
- **Aucune substitution** : un prix payé inconnu n'est plus remplacé par le prix de couverture ; une valeur inconnue n'est plus remplacée par le prix de couverture ni par 0. Les totaux portent sur les données connues, avec leur couverture (« 1 inconnu(s) », « sur N ex. sur M »).
- Affichage « — » pour une valeur inconnue (au lieu de « $0.00 ») ; sommes en centimes ; pourcentages au format français.
- Valeur totale ventilée par source (marché, saisie, cote auto avec sa fourchette) ; carte « Données financières » au tableau de bord.
- Plus d'état « NM 9.4 » inventé à la création (sorties, wishlist, scan continu, séries, import CSV sans état, restauration JSON) ; option « État non renseigné » ; la cote auto signale l'hypothèse et passe en confiance faible.
- **D-18** : à l'ajout, le prix de couverture préremplit le prix d'achat (visible, modifiable, jamais en arrière-plan) ; non enregistré sur une fiche de wishlist ; aucun préremplissage en modification.
- Instantanés de valeur : nouveaux relevés « méthode 2 » ; les anciens relevés sont conservés tels quels et affichés comme « ancienne méthode ».
- Aucune donnée existante modifiée, aucune migration ; devise inchangée (F-D2 ouverte). Test 30 ajouté (30 vérifications) ; suite complète 29/29.

## Phase 3 — Comptes, profils et synchronisation local-first
Conception livrée le 7 novembre 2026 (voir [`phase3/`](phase3/), commit `93f15db`). Le lot 3.1 a été lancé par l'utilisateur le 7 novembre 2026, puis suspendu le même jour avant toute modification de code (copies de sécurité `*.backup.20261107-lot31` créées, non versionnées), pour intégrer la correction « séparation stricte Collection / Explorer ».

## Phase 4 — Explorer 2.0
Cahier des charges fourni par l'utilisateur le 7 novembre 2026 et archivé dans [`phase4/`](phase4/). Révision 2 du 7 novembre 2026 : séparation stricte Collection / Explorer ([frontières et contrats](phase4/02-frontieres-collection-explorer.md)). Révision 3 du même jour : décisions A3, A5, A6 et A7, contrats S1 à S6 détaillés, domaine Community indépendant, [changement de navigation](phase4/03-changement-navigation.md) documenté sans être implémenté. Révision 4 : Sorties limitées aux comics, mangas japonais exclus ([périmètre](phase4/04-perimetre-sorties-comics.md)). Révision 5 (finalisation architecturale) : sauvegardes par domaine (B1, principe approuvé), contrats S1 à S6 de référence, architecture des images R2, propositions de navigation mobile, audit final des dépendances (E1 à E5 ajoutés), plan d'exécution et [journal des décisions](DECISIONS.md). Aucun code modifié. Non commencée ; prérequis : Phase 3.
