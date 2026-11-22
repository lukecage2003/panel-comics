# Journal des décisions — index

La **source unique** est [docs/DECISIONS.md](../DECISIONS.md), qui contient une ligne par décision (D-xxx). Ce fichier ne la recopie pas ; il regroupe les décisions par thème pour s'y retrouver.

| Thème | Décisions |
|---|---|
| Socle local, collection | D-1 à D-60 (voir [HISTORIQUE-LOTS](../HISTORIQUE-LOTS.md)) |
| Garder le client sans framework | Q2 du 13/11/2026 |
| Virage réseau social | D-91 (cadre), D-92 à D-97 (lots S1 à S8) |
| Monétisation et musique | D-98 ([directeur/13](../directeur/13-monetisation-musique-suite.md)) |
| Modération, rôles, double authentification | D-102, D-104, migrations 16 et 17 |
| Langues | D-103 |
| Découvrir, univers, cartes | D-100, D-105 à D-109 |
| Atelier du collectionneur | D-110 |
| Gouvernance, Panel Guardian, documents de référence, retrait de l'ancien nom | D-111, D-112 |
| **Pros et sceau Encré, Le Marché, Le Comptoir, messages chiffrés, offres** | **D-113** |

## Décisions de D-111

Le détail est dans [DECISIONS.md](../DECISIONS.md).

### Panel Guardian (migration 18)
- Il étend l'existant sans le dupliquer.
- Il reste local : la migration n'est pas appliquée.

### Âge et mineurs
- Aucun compte sous 13 ans.
- Les 13-14 ans n'animent pas de direct.
- Les 15-17 ans peuvent animer un club visible des seuls mineurs, sauf si un parent le coupe.

### Lien parental
- Il est créé par le mineur et validé par un adulte en double authentification.
- Le parent ne lit aucun contenu.

### Débats
- Pas de nouveau « Debate Hub » séparé.
- Les débats s'appuient sur les directs, le Duel et les pensées existants.

### Documents
- `docs/master/` est la nouvelle référence centrale.
- Il renvoie aux documents existants au lieu de les recopier.

### Ancien nom
- Il est retiré de tous les documents.
- Les règles de `scripts/import-atlas.js` qui le retirent à l'import sont gardées.

## Décisions de D-113

- **Certification** : le sceau **Encré** (tampon d'encre dentelé, trame, plume ; jaune et noir) pour les créateurs, éditeurs, boutiques et studios. Posé à la main, retirable, jamais vendu.
- **Marché** : adultes seulement, paiement uniquement dans Panel par un prestataire agréé, point relais, colis suivi ou main propre avec code ; pourcentage `[À DÉCIDER]` (simulation à 7 % affichée comme telle).
- **Forum** : Le Comptoir, en cercles, avec débats à deux camps ; il s'ajoute aux débats des directs sans les remplacer.
- **Messages privés** : ouverts, mais chiffrés de bout en bout, adultes seulement, demande avant tout échange. Remplace la règle « pas de messages privés » de D-111.
- **Offres** : Panel, Panel+, Créateur, Éditeur, Boutique ; aucun prix fixé ; un abonnement n'achète jamais de visibilité.
- **Rien n'est en ligne** : migration 19 testée localement seulement (S8 fermé).
