# Architecture produit (D-111)

Vue d'ensemble. Le détail technique est dans [prd/PANEL_TECHNICAL_ARCHITECTURE](../prd/PANEL_TECHNICAL_ARCHITECTURE.md), [panel-2/PANEL_2_GLOBAL_ARCHITECTURE](../panel-2/PANEL_2_GLOBAL_ARCHITECTURE.md) et [domains/README](../../domains/README.md).

## Couches

```
Appareil (toujours)                         Serveur (facultatif, S8 fermé)
┌───────────────────────────────┐           ┌───────────────────────────────────────┐
│ index.html (client sans       │           │ Postgres / Supabase (UE)              │
│ framework, hors ligne)        │  sync     │  app.*        collection synchronisée │
│  ├ domains/** (modules purs)  │◄────────► │  community.*  fil, directs, modération│
│  ├ IndexedDB / localStorage   │  (S8)     │  guardian.*   âge, parents, limites   │
│  └ sw.js (cache, hors ligne)  │           │  api.*        seule porte d'entrée    │
└───────────────────────────────┘           └───────────────────────────────────────┘
```

## Modules et frontières

| Domaine | Rôle | Frontière |
|---|---|---|
| `collection` | Exemplaires, boîtes, statistiques | Données privées : jamais dans une publication (`community.payload_ok`) |
| `catalog`, `releases`, `source` | Éditions, sorties, provenance par champ | Données externes : licence et source notées |
| `reading` | Lecture, progression | Privé |
| `explorer` | Découvrir, univers, cartes, guides | Fonctions `ex*` et `gd*` : aucun identifiant personnel (`check-boundaries --strict`) |
| `community` | Fil, notes, J'aime, directs, rencontres, modération, politique | Local aujourd'hui ; côté serveur, la politique est appliquée par `api.*` et les déclencheurs |
| `account` | Connexion facultative | S8 |
| `i18n` | Langues | Français source |
| `guardian` (serveur) | Âge, parents, restrictions | Tables fermées ; accès par `api.guardian_*` seulement |

## Règles d'architecture

1. On ne remplace pas la pile.
2. On ne crée pas de système en double : Guardian étend `community` (âge, séparation adultes et mineurs) au lieu de le recopier.
3. Toute règle de sécurité vit **côté serveur**. Le client ne fait qu'afficher.
4. Pas de donnée personnelle dans les URL.
5. Pas de suppression destructive.
   - Les migrations sont additives.
   - `migrations.test.js` interdit `drop table`, `drop schema` et `truncate`.
