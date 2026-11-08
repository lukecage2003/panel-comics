# Sauvegardes indépendantes par domaine (B1) — spécification

Statut : **implémenté au sous-lot 3.1b-1 (8 novembre 2026)**. Décisions : B1-a deux versions (D-23), B1-b secrets exclus et option chiffrée (D-24), B1-c `panel-bundle` (D-25). API : `Panel.backup` ; tests R1 à R9 : test 32 de `run-all-tests.js` (R10 : la suite complète). Écarts avec ce document : voir § 11.

Légende : **[Fait]** · **[Décidé]** · **[Reco.]** · **[À valider]**.

## 1. Existant [Fait]
| Format | Contenu | Producteur |
|---|---|---|
| `panel-backup` v3 (sauvegarde complète, `index.html` l. 12440-12448) | Données numériques héritées (`readStoredDigitalData`, avec clés de services), `physicalSingles`, `seriesMeta`, `locations`, `releases` (publications et Pull List), `explorer` (guides éditoriaux et progression), `exportedAt` | Application |
| `panel-singles` v2 (export Collection, l. 11414 ; import l. 11487) | `singles`, `seriesMeta`, `locations`, `releases`, `explorer`, `exportedAt` | Collection, qui appelle `exportExplorerData` et `sanitizeExplorerData` (couplages D2 et D3) |
| Instantanés IndexedDB (`panel-library/snapshots`, 8 conservés) | Collection | Application |
| Validation et restauration | `validateBackupPayload`, `applyBackupRestore` : aperçu, fusion par défaut, instantané avant restauration, annulation | Application |

## 2. Responsabilités [Décidé]
| Domaine | Section de sauvegarde | Contenu | Exclu |
|---|---|---|---|
| **Collection** | `collection` | Exemplaires possédés et wishlist (`physicalSingles`), séries suivies (`seriesMeta`), emplacements (`locDoc`), **Pull List** (`pulls`, avec leur instantané `ref`), historique de valeur personnel | Publications éditoriales, guides, secrets |
| **Lecture** | `reading` | Progression des guides (`readprog`) ; `isRead` reste un champ d'exemplaire, donc dans `collection` (compatibilité, A3) | Contenu des guides |
| **Explorer** | `explorer` | Guides éditoriaux locaux (`editorial`), publications du calendrier (`publications`), relations et historique de publication, réglages Explorer | Toute donnée personnelle |
| **Community** (futur) | `community` | Défini avec Community | — |
| **Application** (service commun) | `app` | Préférences locales, profil local, manifeste | **Secrets** (clés Comic Vine, Metron), sauf option explicite et chiffrée [Reco.] |
| Hors périmètre | `legacyDigital` | Données numériques héritées de la Phase 1 : conservées telles quelles, exportées seulement dans la sauvegarde complète, comme aujourd'hui | — |

## 3. Nouveau format : `panel-bundle` v1
```json
{
  "format": "panel-bundle",
  "version": 1,
  "createdAt": "2026-11-07T12:00:00.000Z",
  "app": { "version": "…", "platform": "web|android", "profileId": "usr_local_…" },
  "manifest": {
    "collection": { "provider": "collection", "schema": 1, "count": { "singles": 0, "locations": 0, "pulls": 0, "seriesMeta": 0 }, "sha256": "…" },
    "reading":    { "provider": "reading",    "schema": 1, "count": { "progress": 0 }, "sha256": "…" },
    "explorer":   { "provider": "explorer",   "schema": 1, "count": { "guides": 0, "publications": 0 }, "sha256": "…" }
  },
  "sections": {
    "collection": { "…": "données du fournisseur Collection" },
    "reading":    { "…": "données du fournisseur Lecture" },
    "explorer":   { "…": "données du fournisseur Explorer" }
  }
}
```
- Chaque section est **autonome** : un fichier peut ne contenir que `collection` (export Collection seul), que `explorer`, ou toutes les sections (sauvegarde complète).
- `sha256` est calculé sur la sérialisation stable (`stableJson`) de la section.
- Une section inconnue est **conservée telle quelle** et signalée, jamais supprimée.

## 4. Contrat fournisseur : `BackupProvider.v1`
Chaque domaine déclare un fournisseur ; le service de sauvegarde (commun) ne connaît que ce contrat.

| Fonction | Rôle | Règles |
|---|---|---|
| `id`, `schema` | Identité et version de la section | — |
| `export()` | Renvoie la section et ses comptes | Lecture seule ; aucune donnée d'un autre domaine |
| `validate(section, schema)` | Contrôle structurel, nettoyage, comptes, anomalies | Ne modifie rien ; renvoie `{ ok, counts, anomalies[], migratedFrom? }` |
| `preview(section, mode)` | Ce qui serait ajouté, modifié ou ignoré (`merge` par défaut, `replace` sur confirmation) | Ne modifie rien |
| `restore(section, mode)` | Application dans une transaction du domaine | Instantané du domaine **avant** ; renvoie un `undoToken` |
| `undo(undoToken)` | Retour à l'état d'avant la restauration | Disponible au moins jusqu'à la fermeture de l'application |
| `fingerprint()` | Empreinte des données du domaine | Pour la vérification après restauration |

Règles inter-domaines :
- Aucun fournisseur n'appelle un autre fournisseur ; le service orchestre.
- Les références entre domaines (exemplaire → publication `pubId`, Pull List → publication) sont des **identifiants** ; une référence absente après restauration reste **intacte** (la Pull List garde son instantané `ref`), jamais supprimée.
- Ordre de restauration recommandé pour une sauvegarde complète : `explorer`, puis `collection`, puis `reading` (les références se résolvent mieux) ; chaque domaine reste restaurable seul.

## 5. Compatibilité avec les anciennes sauvegardes
| Fichier | Lecture | Correspondance |
|---|---|---|
| `panel-backup` v3 | **Toujours lisible** | `physicalSingles`, `seriesMeta`, `locations` et la partie `pulls` de `releases` → `collection` ; `explorer.progress` → `reading` ; `explorer.editorial` et la partie `publications` de `releases` → `explorer` ; données numériques → `legacyDigital` |
| `panel-singles` v2 | **Toujours lisible** | Même correspondance |
| `panel-backup` et `panel-singles` antérieurs | Lisibles comme aujourd'hui | Correspondance existante, puis découpage ci-dessus |

- Le découpage d'un ancien fichier se fait **en mémoire**, à la lecture : le fichier d'origine n'est **jamais** réécrit.
- L'écriture produira `panel-bundle` v1. Pendant au moins deux versions de l'application, l'utilisateur pourra encore exporter l'ancien format (option « format compatible ») **[Reco.]**.

## 6. Migrations
- Migration = **conversion à la lecture**, déterministe et testée (`v3 → bundle`, `v2 → bundle`).
- Chaque fournisseur migre sa propre section (`schema` N-1 → N) ; aucune migration n'est appliquée aux données en place sans sauvegarde préalable.
- **Réversibilité** : l'ancien fichier reste intact ; une restauration a son `undoToken` et un instantané ; un export `panel-bundle` peut être reconverti au format v3 (conversion inverse fournie et testée), ce qui rend le passage réversible.
- Aucune migration de stockage (IndexedDB, localStorage) n'est nécessaire pour B1 : seuls les formats d'export et de restauration changent.

## 7. Contrôles d'intégrité
1. **Structure** : `format`, `version` et sections connues ; taille maximale ; JSON valide.
2. **Empreintes** : `sha256` de chaque section égal au manifeste ; sinon, section marquée « altérée », restaurable seulement sur confirmation explicite.
3. **Comptes** : comptes du manifeste égaux aux comptes relus.
4. **Identifiants** : uniques par domaine ; rapport des doublons (`idReport`) ; aucune fiche sans identifiant restaurée sans correction proposée.
5. **Références** : `pubId`, `locationId` et `pull.pubId` résolus ou signalés « non résolus », jamais supprimés.
6. **Après restauration** : `fingerprint()` comparée à l'attendu ; écarts rapportés.

## 8. Protections contre la perte et l'écrasement
- Fusion par défaut ; remplacement seulement sur confirmation saisie, avec aperçu chiffré.
- Instantané de chaque domaine concerné avant restauration ; annulation.
- **Garde-fou anti-cataclysme** : une restauration qui supprimerait plus de 50 fiches ou plus de 10 % d'un domaine exige une confirmation renforcée (même règle que la synchronisation, [`../phase3/04-synchronisation.md`](../phase3/04-synchronisation.md) § 3.2).
- Couvertures manuelles et champs protégés conservés (règle actuelle).
- Restaurer un domaine ne touche **aucun** autre domaine (vérifié par empreintes).
- Les secrets ne sont pas exportés par défaut ; restaurer une sauvegarde sans secrets ne les efface pas.
- Aucune sauvegarde existante n'est supprimée ni réécrite.

## 9. Tests de restauration (à écrire au lot 3.1b)
| # | Test |
|---|---|
| R1 | Lecture de vrais fichiers `panel-backup` v3 et `panel-singles` v2 (anonymisés) : comptes et empreintes identiques à la restauration actuelle |
| R2 | `panel-bundle` complet : export → restauration sur une base vide → empreintes identiques |
| R3 | Section seule (`collection`, `explorer`, `reading`) : les autres domaines restent inchangés (empreintes) |
| R4 | Fichier altéré (empreinte fausse) : refus sans confirmation |
| R5 | Références non résolues : conservées et signalées |
| R6 | Annulation : retour à l'empreinte d'avant |
| R7 | Conversion inverse bundle → v3 : relisible par la version actuelle |
| R8 | Garde-fou : une restauration en mode remplacement d'une base de 500 fiches par 10 fiches exige la confirmation renforcée |
| R9 | Explorer absent (fournisseur non déclaré) : l'export et la restauration de Collection fonctionnent |
| R10 | Tous les tests existants (30 au 8 novembre 2026) restent verts, en particulier « Protection des données » et la restauration JSON fidèle |

## 10. Décisions ouvertes
- **B1-a** : durée de maintien de l'export à l'ancien format (proposé : deux versions).
- **B1-b** : export facultatif et chiffré des secrets, ou exclusion définitive.
- **B1-c** : nom définitif du format (`panel-bundle`).

## 11. Réalisation (sous-lot 3.1b-1, 8 novembre 2026)
- **Fournisseurs** : `collection`, `reading`, `explorer`, `app`. Le domaine de chacun vient de `SYNC_DOMAINS` (lot 3.1) : une seule source de vérité.
- **Sections spéciales** :
  - `legacyDigital` : données des anciens fichiers numériques. Exportée, jamais restaurée, comme aujourd'hui.
  - `secrets` : uniquement sur demande explicite. Chiffrement AES-GCM 256, clé dérivée du mot de passe saisi par PBKDF2-SHA256 (310 000 itérations), 8 caractères au minimum. Une clé déjà présente n'est jamais écrasée.
- **Profil local** (`relMeta.profile`) : rangé dans la section `app`.
- **Interface** :
  - « Export JSON » produit le `panel-bundle` complet ;
  - « Sauvegarde par domaine… » permet de choisir les domaines, le format compatible v3 (D-23) et les clés chiffrées ;
  - la restauration d'un `panel-bundle` affiche, par domaine, les comptes, l'intégrité et une case à cocher. L'annulation est proposée dans le message de fin.
- **Anciens fichiers** (v3, v2, tableau) : ils suivent toujours l'ancienne restauration, sans changement. `Panel.backup.fromLegacy` fait le découpage en mémoire (R1).
- **Restauration** : elle réutilise `applyBackupRestore`, qui accepte désormais `items: null` pour ne pas toucher à la Collection et renvoie une fonction d'annulation. Le garde-fou exige une confirmation saisie (« REMPLACER ») au-delà de 50 fiches ou de 10 % de la collection.
- **Pas de nouvelle base ni de nouveau store** ; aucune donnée existante réécrite au chargement.
- **Écarts** :
  - un fichier `panel-bundle` ne peut pas encore être reconverti par l'interface (seulement par `Panel.backup.toV3`) ;
  - l'export JSON de la Collection (`panel-singles` v2) est séparé au sous-lot 3.1b-4.
- **Sous-lot 3.1b-4 (8 novembre 2026)** : le bouton « JSON » de Collection produit un `panel-bundle` v1 réduit à la section `collection` (`panel_collection_AAAA-MM-JJ.json`) ; l'ancien `panel-singles` v2 reste proposé pendant deux versions (D-23) : action « Ancien format » après l'export et option de la fenêtre « Sauvegarde par domaine ». Il est reconstruit à partir des fournisseurs, avec le même contenu qu'avant (vérifié par le test 34). Les anciens fichiers v2 et v3 restent lisibles et sont répartis par domaine.

