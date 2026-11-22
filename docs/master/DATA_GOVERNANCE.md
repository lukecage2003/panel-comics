# Gouvernance des données (D-111)

Le modèle détaillé est dans [prd/PANEL_DATA_MODEL](../prd/PANEL_DATA_MODEL.md) et [panel-2/PANEL_2_DATA_ARCHITECTURE](../panel-2/PANEL_2_DATA_ARCHITECTURE.md).

## Catégories

| Catégorie | Exemples | Où | Partagée ? |
|---|---|---|---|
| Collection privée | Prix payé, cote, emplacement, notes, date d'achat | Appareil ; serveur si l'utilisateur synchronise | **Jamais publiée** (`payload_ok` refuse ces champs) |
| Bibliothèque numérique (ancienne) | PDF, CBZ, marque-pages, annotations, positions | IndexedDB de l'appareil | Jamais ; **ne jamais supprimer**, archive ZIP disponible |
| Profil social | Pseudo, bio, étagère choisie | Serveur (S8) | Selon la visibilité ; toujours privé pour un mineur |
| Âge | Tranche d'âge (13-14, 15-17, 18+) et statut | Serveur | Jamais ; la date de naissance n'est pas conservée |
| Liens parentaux | Lien, réglages, journal | Serveur (`guardian.*`) | Parent et jeune seulement, via l'API |
| Modération | Signalements, décisions, appels | Serveur | Équipe en double authentification |
| Données externes | Fiches de séries, sorties, univers | Appareil (cache) | Source et licence par champ (`source/claims-core`) |

## Provenance et licences

- Chaque donnée externe garde sa **source**. Aucune source n'est cachée ni contournée.
- **Images** :
  - jamais présentées comme officielles sans vérification ;
  - les cartes de l'atlas portent « plan de fan » et © Marvel / © DC.
- **Avant le lancement public**, il faut un tableau des sources avec, pour chacune :
  - la licence ;
  - l'usage permis ;
  - la mention obligatoire `[À COMPLÉTER]`.
- **Metron** : son mot de passe n'est jamais utilisé ni stocké.
- **LoCG** : le fichier xlsx est lu sans jamais être modifié.

## Conservation (propositions, ⚖ à valider)

| Donnée | Durée proposée |
|---|---|
| Compte supprimé | Effacement immédiat par cascade (`app.delete_account`), y compris `guardian.*` (testé) |
| Pierres tombales de synchronisation | Purge au-delà de 90 jours (`app.purge_due`) |
| Journal de modération | `[À COMPLÉTER ⚖]` (preuve en cas de recours) |
| Code parental | 48 h, haché, usage unique |
| Restriction de compte | 1 à 365 jours, puis expirée |

## Interdits

Ne jamais faire les opérations suivantes :
- réinitialiser IndexedDB ou le stockage local ;
- supprimer des sauvegardes ;
- transmettre des données personnelles à un tiers sans base légale ;
- créer de fausses données, couvertures ou associations ;
- modifier les données réelles de l'utilisateur pendant les tests.
