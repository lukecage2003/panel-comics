# Phase 4 · 07 — Architecture des images (Cloudflare R2)

Statut : **documenté, non implémenté**. Ce document précise le § 3 du [cahier des charges](00-explorer-2.0-cahier-des-charges.md) et le contrat S4 ([`05`](05-contrats-s1-s6.md) § 6). Aucun compte Cloudflare n'est créé ; aucune dépense n'est engagée.

Légende : **[Fait]** · **[Doc]** documentation officielle consultée le 7 novembre 2026 · **[Reco.]** · **[À valider]**.

## 1. État actuel du code [Fait]
- Il n'y a ni R2 ni registre d'images. Les couvertures sont des **URL** stockées dans les fiches : `coverUrl` et `coverSource` pour les exemplaires (Collection), `cover` pour les publications et les entrées de guides (Explorer, lots 2.4 à 2.6).
- Il existe déjà une provenance des couvertures et une protection des couvertures manuelles (lots 2.5, Fandom), ainsi qu'un placeholder (`placeholderCover`).
- Les couvertures Comic Vine sont récupérées en arrière-plan avec des quotas ; la licence relevée au lot 2.5 est **non commerciale**.

## 2. Faits Cloudflare R2 [Doc]
- Stockage Standard : 0,015 $ par Go et par mois ; opérations de classe A : 4,50 $ par million ; classe B : 0,36 $ par million ; **sortie (egress) gratuite** via l'API S3, Workers ou `r2.dev`.
- Palier gratuit mensuel (Standard) : 10 Go-mois, 1 million d'opérations A, 10 millions d'opérations B.
- L'URL `r2.dev` est **réservée au développement** : limitée en débit, sans cache, WAF ni contrôle d'accès. En production, il faut un **domaine personnalisé**, qui permet le cache Cloudflare (règle « Cache Everything » recommandée pour tous les types de fichiers), le WAF et le contrôle d'accès ; il faut alors désactiver `r2.dev`.
- R2 est **compatible avec l'API S3** ; il ne transforme pas les images (le traitement est à la charge d'un worker ou d'un service distinct).

Sources : https://developers.cloudflare.com/r2/pricing/ · https://developers.cloudflare.com/r2/buckets/public-buckets/

## 3. Architecture cible
```
 Sources autorisées ──► Worker d'import ──► Contrôle des droits ──► Worker de traitement ──► R2 (originaux autorisés + variantes)
        │                    │                    │                        │                         │
        ▼                    ▼                    ▼                        ▼                         ▼
   media.sources      media.jobs (file)     media.rights           media.variants            CDN (domaine personnalisé)
                             └────────────► media.assets ◄──────── media.entity_links (par domaine) ◄── Explorer / Collection (S4)
                                                  └── media.audit_logs
```
| Composant | Rôle | Choix |
|---|---|---|
| Stockage | Fichiers (originaux autorisés, variantes) | Cloudflare R2, derrière une interface `MediaStore` (`put`, `get`, `delete`, `head`, `signedUrl`) pour pouvoir changer de fournisseur [Décidé : R2 ; Reco. : interface] |
| Registre | Métadonnées, relations, droits, provenance, statuts | Postgres (Supabase), schéma `media` |
| File de tâches | Import, traitement, vérification, actualisation | Table `media.jobs` (types : `import`, `process`, `verify`, `refresh`, `withdraw`) avec statuts `pending`, `processing`, `completed`, `needs_review`, `failed`, `cancelled` [Reco. : une file typée plutôt que deux tables] |
| Worker d'import | Recherche dans les sources autorisées, correspondance, téléchargement | Hébergement **[À valider]** : Edge Function Supabase, conteneur Node, ou Cloudflare Worker |
| Worker de traitement | Contrôles, déduplication, variantes | Bibliothèque de traitement d'images dans un conteneur Node **[Reco.]** ; alternative payante : Cloudflare Images **[À valider]** |
| Livraison | URL publiques des images publiées | Domaine personnalisé + cache Cloudflare ; `r2.dev` désactivé en production [Doc] |
| Cache client | Hors ligne | Service Worker : variantes consultées, avec un plafond de taille |

## 4. Registre (schéma `media`)
| Table | Contenu principal |
|---|---|
| `assets` | `id uuid`, `sha256` (unique), `mime`, `width`, `height`, `bytes`, `storage_key`, `original_kept bool`, `processing_status`, `review_status`, `publication_status` (`draft`, `published`, `withdrawn`), `created_at`, `verified_at` |
| `variants` | `asset_id`, `variant` (`thumb`, `card`, `cover`, `detail`, `hero`), `format` (`webp`, `avif`, `jpeg`, `png`), `width`, `height`, `bytes`, `storage_key` |
| `sources` | Source (nom, type, conditions d'utilisation, URL des conditions, date de vérification) |
| `rights` | `asset_id`, `source_id`, `rights_class` (§ 6), droits de stockage, de transformation et d'affichage, attribution exigée, restrictions commerciales et géographiques, preuve (référence de licence), vérifié par, date |
| `entity_links` | `asset_id`, **`domain`** (`explorer`, `collection`, plus tard `community`), `entity_type` (`issue`, `variant`, `series`, `event`, `character`, `creator`, `publisher`, `guide`, `editorial`), `entity_id`, `role` (`primary`, `secondary`, `variant`, `banner`), `confidence`, `validated_by` |
| `jobs` | File (type, entité, source, priorité, statut, tentatives, dernière erreur, prochaine tentative, résultat, clé d'idempotence) |
| `audit_logs` | Toute action (import, remplacement, retrait, validation), par qui et quand |

Clés R2 déterministes : `{entity_type}/{entity_id}/{asset_id}/{variant}.{format}` ; jamais à partir d'un titre (cahier § 3.4).

## 5. Séparation des domaines
- Les associations portent un `domain`. Explorer ne crée que des associations `explorer` ; Collection, si elle le décide plus tard, des associations `collection`, **sur ses propres règles**.
- Un import Explorer **ne modifie jamais** `coverUrl`, `coverSource` ni aucun champ d'un exemplaire. Collection peut proposer à l'utilisateur d'utiliser une image du registre pour un exemplaire relié au catalogue (`catalog_issue_id`), sans écraser une couverture manuelle.
- Les **images personnelles** (couvertures manuelles, photos d'exemplaires) ne sont **jamais** versées au registre public, sauf contribution volontaire avec cession de droits (lot 4.10).
- Test de frontière : empreinte de Collection identique avant et après un import massif.

## 6. Droits, licences, provenance
| Classe de droits | Copie sur R2 | Affichage |
|---|---|---|
| `licensed_hosted` : licence autorisant le stockage et la transformation | Oui | Oui, avec attribution si exigée |
| `provider_hosted` : hébergée par le fournisseur, affichage autorisé | Non | URL du fournisseur, selon ses conditions |
| `reference_only` : référence autorisée sans copie | Non | Lien ou affichage selon les conditions |
| `user_contributed` : contribution avec cession de droits | Oui, après modération | Oui |
| `specific_license` : licence particulière | Selon la licence | Selon la licence |
| `unknown` : droits inconnus | **Jamais** | **Non** (placeholder) |

- Une URL publique n'est **jamais** une autorisation.
- Chaque source a une fiche de droits **vérifiée et datée** ; la matrice des droits par source est le premier livrable du lot 4.1 ([`01`](01-analyse-et-impacts.md) § 2).
- **Remplacement** : nouvel asset, ancienne association `withdrawn`, historique conservé ; purge du fichier R2 de l'ancien asset seulement s'il n'est plus associé nulle part et après confirmation (opération destructive).
- **Retrait** (demande d'un ayant droit) : publication `withdrawn` immédiate, purge du cache CDN, conservation de la preuve dans `audit_logs`.

## 7. Import initial en masse et import progressif
- **Initial** (lot 4.3) : inventaire des entités sans image → recherche dans les seules sources autorisées → correspondance (§ 8) → contrôle des droits → import par lots (taille et débit limités par source) → traitement → publication → vérification d'accessibilité → rapport de couverture. Reprise grâce à la file et aux clés d'idempotence.
- **Priorités** : comics les plus demandés selon S3 (et non les collections individuelles), événements et guides existants, Key Issues, sorties récentes et à venir **de comics** ([`04`](04-perimetre-sorties-comics.md)), personnages, puis le reste.
- **Progressif** (lot 4.8) : déclencheurs (nouvelle entité, nouvelle sortie, guide publié, fiche consultée sans image, image cassée, nouvelle version d'une source, correction éditoriale), toujours **asynchrones** ; l'interface affiche un placeholder pendant le traitement.
- **Débit** : concurrence limitée par source (par exemple 2 à 4 téléchargements simultanés), backoff exponentiel, respect des quotas de chaque fournisseur.

## 8. Correspondance
- Critères : identifiants externes, identifiant canonique, éditeur, série, volume, numéro, année, édition, variante, date de publication, `medium` (comics seulement).
- Confiance élevée : association automatique **si** les droits sont vérifiés ; intermédiaire : `needs_review` ; faible : aucune association.
- Jamais de substitution d'une autre édition ou d'une autre variante.

## 9. Traitement, déduplication, variantes
- Contrôles : type MIME **et** signature réelle (octets magiques), taille maximale, dimensions minimales, fichier décodable, suppression des métadonnées EXIF.
- Déduplication : `sha256` exact ; deux couvertures **visuellement proches** ne sont **jamais** fusionnées automatiquement (signalement seulement, par exemple avec une empreinte perceptuelle).
- Variantes : `thumb`, `card`, `cover`, `detail` (proportions d'origine, sans recadrage pour les couvertures), `hero` (ratio éditorial, recadrage validé) ; formats WebP en priorité, AVIF si la chaîne le permet, JPEG ou PNG en repli.
- Original conservé **seulement** si les droits le permettent (`original_kept`).

## 10. Erreurs et images manquantes
- Image absente ou en traitement : placeholder cohérent avec l'indication « image non disponible », **jamais** une image arbitraire.
- Image cassée (vérification périodique `head`) : tâche `verify`, puis `refresh` ; statistiques dans l'administration (lot 4.10).
- Indicateurs de couverture visuelle (cahier § 16) calculés depuis le registre.

## 11. Coûts et décisions [À valider]
- Ordre de grandeur, à confirmer au lot 4.1 avec les volumes réels : 100 000 images × 5 variantes × environ 80 Ko ≈ 40 Go, soit environ 0,45 $ par mois au-delà du palier gratuit, hors opérations [calcul indicatif sur les tarifs Doc].
- Décisions : compte Cloudflare et domaine (décision financière) ; hébergement des workers ; Cloudflare Images ou traitement maison ; plafond de dépenses.
