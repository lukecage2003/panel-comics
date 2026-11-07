# Phase 4 · 01 — Explorer 2.0 : analyse, impacts sur la Phase 3, points à arbitrer

Rédigé le 7 novembre 2026, à la réception du [cahier des charges Explorer 2.0](00-explorer-2.0-cahier-des-charges.md). **Aucun lot de la Phase 4 n'est commencé.** Le lot 4.1 (audit et architecture) approfondira ces éléments.

> *Révision 3* : la séparation Collection / Explorer, les décisions A3, A5, A6 et A7 et les contrats S1 à S6 sont définis dans [`02-frontieres-collection-explorer.md`](02-frontieres-collection-explorer.md), qui prime sur ce document. Changement de navigation : [`03-changement-navigation.md`](03-changement-navigation.md).

Légende : **[Fait]** · **[Doc]** · **[Hyp.]** · **[Reco.]** · **[À valider]** (voir [`../phase3/README.md`](../phase3/README.md)).

## 1. Décisions désormais tranchées par l'utilisateur
| Sujet | Décision | Effet |
|---|---|---|
| Fournisseur backend | **Supabase / PostgreSQL** | La décision « fournisseur » du dossier de Phase 3 est close |
| Stockage des images | **Cloudflare R2** (API compatible S3), pas Supabase Storage | `avatar_path` (profil) et les couvertures manuelles volumineuses (`04` § 1) iront aussi, à terme, dans le registre média et sur R2 ; rien n'est stocké en Phase 3 |
| Ordre des phases | Phase 3 (comptes, synchronisation, sauvegardes, permissions) **avant** Explorer 2.0 | Feuille de route : Phase 4 = Explorer 2.0, lots 4.1 à 4.11 |
| Gestion éditoriale | Hybride : automatisation, validation humaine, contributions | Il faut des **rôles serveur** (§ 3) |
| Périmètre des Sorties | **Comics uniquement**, mangas japonais exclus des calendriers, classements, actualités et recommandations de sorties | Voir [`04`](04-perimetre-sorties-comics.md) ; le calendrier actuel (lot 2.4) n'est pas conforme |
| Séparation des modules | Collection et Explorer indépendants ; décisions A3 (progression = domaine Lecture), A5 (sorties = Explorer), A6 (entrée de navigation propre), A7 (pas de recherche « Ma collection » dans Explorer) | Voir [`02`](02-frontieres-collection-explorer.md) et [`03`](03-changement-navigation.md) |

## 2. Point de tension principal : catalogue partagé et licences
Le dossier de Phase 3 recommandait de **ne pas** synchroniser ni partager le catalogue et les publications, car la licence Comic Vine relevée au lot 2.5 est **non commerciale** **[Fait]**. Explorer 2.0 suppose au contraire un **catalogue serveur commun** (événements, Key Issues, séries, créateurs, sorties) et un **fonds d'images** stocké sur R2.

Les deux sont compatibles si l'on applique la règle du cahier des charges (§ 11) **aux métadonnées comme aux images** :
- chaque fiche du catalogue serveur porte sa **source** et ses **droits** (`data_sources`, provenance par champ, déjà en place localement depuis le lot 2.5) ;
- une source dont la licence n'autorise pas le stockage serveur ou l'usage commercial **n'alimente pas** le catalogue partagé : elle reste un enrichissement **local et personnel**, comme aujourd'hui ;
- l'usage d'images issues de Comic Vine, Metron ou des sites d'éditeurs exige une **autorisation explicite** ; une URL publique ne vaut pas autorisation.

Conséquence **[Reco.]** : le lot 4.1 doit commencer par une **matrice de droits par source** (accès API, stockage, transformation, affichage, attribution, usage commercial), à faire valider juridiquement. Sans source exploitable, le fonds d'images initial (lot 4.3) se limitera aux images fournies par les éditeurs sous licence, aux contributions dont les droits sont cédés, et aux références sans copie (« image référencée sans copie locale »), si les conditions de la source l'autorisent.

## 3. Ce que la Phase 3 doit livrer en plus pour préparer Explorer 2.0
| Prérequis | Lot de Phase 3 | Détail |
|---|---|---|
| **Rôles et permissions serveur** (`admin`, `editor`, `moderator`) | **3.3** | Table `app.staff_roles(user_id, role, granted_by, granted_at)`, fonction `app.has_role(role)` (`security definer`, `search_path=''`), RLS ; attribution manuelle seulement (pas d'interface publique). **Un rôle ne donne aucun accès aux données personnelles** (`app.*`), ce que des tests doivent prouver |
| **Schémas réservés** | **3.1** | `app` = données personnelles (Collection, Lecture, profil) ; `catalog`, `editorial`, `media` et `signals` réservés à la Phase 4, `community` au futur domaine Community, tous Phase 4 et **non créés** en Phase 3. Le banc de tests doit savoir appliquer des migrations multi-schémas |
| **Journal des modifications** générique | 3.6 | Le patron de `sync_conflicts` et du journal d'administration servira à `change_history` et `media_audit_logs` |
| **Consentement pour les signaux communautaires** | 3.6 | Via le service d'agrégation dédié uniquement (contrat S3). Les classements communautaires (§ 6.2) agrègent collections et wishlists, aujourd'hui « privées par défaut ». Il faut décider (et faire valider) si l'agrégation anonyme est couverte par le contrat ou exige un réglage explicite ; seuil minimal d'agrégation (k-anonymat, par exemple ≥ 10 utilisateurs) **[Reco.]** |
| **Identifiants canoniques** | 3.4 | Les identifiants clients (`s_…`) restent personnels. Le catalogue serveur aura ses propres identifiants (`uuid`), Un rapprochement facultatif `catalog_issue_id` pourra être ajouté **plus tard, de façon additive, à l'initiative de Collection et proposé à l'utilisateur** (contrat S5) ; il ne fait pas partie des lots Explorer |

Le lot 3.1 reste dans son périmètre ; seul l'ajout des schémas réservés est **documenté** (pas créé).

## 4. Architecture images : premières recommandations (à confirmer au lot 4.1)
- **Registre** : `media.assets`, `media.entity_links`, `media.sources`, `media.rights`, `media.variants`, `media.jobs`, `media.audit_logs`, dans Postgres. Le cahier en propose huit ; la fusion des deux files (`import_jobs`, `processing_jobs`) en une seule table typée est à étudier **[Reco.]**.
- **Clés R2** : `{type_entité}/{id_entité}/{asset_id}/{variante}.{format}`, sans jamais utiliser de titre **[Reco.]**, conformément au § 3.4.
- **Traitement** : R2 ne transforme pas les images. Options : un worker Node (bibliothèque de traitement d'images) dans un conteneur, Cloudflare Images (payant), ou une Edge Function Supabase (limites de mémoire et de durée à vérifier) **[À valider]**.
- **Livraison** : bucket public sur un **domaine personnalisé** derrière le CDN Cloudflare. L'URL de développement `r2.dev` n'est pas destinée à la production **[Hyp., à vérifier dans la documentation R2]**.
- **Coûts** : R2 n'a pas de frais de sortie (egress) et dispose d'un palier gratuit **[Hyp., chiffres à relever dans la documentation officielle au lot 4.1]**. Aucun compte n'est créé tant que ce n'est pas autorisé.
- **Abstraction** : une interface `MediaStore` (put, get, delete, signedUrl) côté worker, pour pouvoir changer de fournisseur (§ 3.3 du cahier).

## 5. Risques propres à Explorer 2.0
| Risque | Gravité | Parade |
|---|---|---|
| Aucune source d'images exploitable commercialement | **Bloquant** pour le fonds visuel | Matrice des droits dès le lot 4.1 ; démarches auprès des éditeurs ; placeholders honnêtes |
| Mauvaise couverture associée (édition, variante) | Élevée | Moteur de confiance à trois niveaux ; validation humaine ; jamais de substitution silencieuse |
| Coûts de traitement et de stockage | Moyenne | Variantes générées à la demande puis mises en cache ; quotas ; plafond de dépenses |
| Manipulation des classements | Moyenne | Agrégations planifiées, dédoublonnage par compte, comptes vérifiés seulement |
| Charge éditoriale (validation humaine) | Élevée | Outils d'administration en masse (lot 4.10) ; priorités du § 3.6 |
| Volume de données qui dépasse le palier Pro de Supabase | Moyenne | Images hors Postgres (R2) ; index ; pagination |

## 6. Questions à trancher avant le lot 4.1
1. Sources d'images visées en priorité (éditeurs, fournisseur sous licence, contributions).
2. Statut juridique de l'éditeur de Panel (nécessaire pour toute licence commerciale).
3. Hébergement du worker de traitement.
4. Politique de consentement pour les classements communautaires.
5. Seuils de couverture visuelle exigés avant la bêta (§ 16 du cahier).
