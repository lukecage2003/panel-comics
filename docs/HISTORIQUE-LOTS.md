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

## Phase 3 — Comptes, profils et synchronisation local-first
Conception livrée le 7 novembre 2026 (voir [`phase3/`](phase3/)). Aucun lot n'est commencé ; le lot 3.1 attend la validation de l'utilisateur.
