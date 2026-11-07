# Phase 3 · 05 — Sauvegardes, résilience, confidentialité et RGPD

Statut : **conception à valider**. **Ce document n'est pas un avis juridique.** Il distingue les obligations légales identifiées (RGPD, textes CNIL) des bonnes pratiques, et liste ce qui doit être validé par un professionnel avant toute bêta.

Légende : **[Fait]** constaté dans le code · **[Doc]** documentation officielle consultée le 7 novembre 2026 · **[Hyp.]** hypothèse · **[Reco.]** recommandation · **[À valider]** décision de l'utilisateur.

## 1. Sauvegardes : état actuel et cible
| Niveau | Aujourd'hui | Cible Phase 3 |
|---|---|---|
| Local, automatique | 8 instantanés IndexedDB (`panel-library/snapshots`) **[Fait]** | Inchangé ; un instantané en plus avant chaque migration vers le cloud, chaque resynchronisation complète et chaque application d'un lot de suppressions distantes |
| Local, manuel | Export JSON `panel-backup` v3 / `panel-singles` v2, avec blocs `explorer` et `releases` **[Fait]** | Inchangé, toujours disponible **sans compte**. Les secrets (`panel_comicvine_key`, `panel_metron_creds`) **sortent des exports par défaut** (option explicite pour les inclure) **[Reco.]** |
| Cloud, fournisseur | — | Supabase Pro : sauvegardes quotidiennes conservées 7 jours ; Free : **aucune sauvegarde** **[Doc]**. PITR en option à 100 $/mois **[Doc]** : non recommandé au départ |
| Cloud, indépendant | — | Export logique hebdomadaire (`pg_dump` du schéma `app`) chiffré, stocké hors du fournisseur, conservé 4 semaines **[Reco.]**, à automatiser au lot 3.6 |
| Par utilisateur | — | `export_my_data()` : JSON complet de ses données serveur (portabilité) ; restauration **côté client**, via l'aperçu existant d'import JSON |

Limites importantes **[Doc]** :
- une restauration Supabase porte sur **le projet entier** : on ne restaure pas un seul utilisateur depuis une sauvegarde du fournisseur ;
- les objets de Storage ne sont pas inclus dans les sauvegardes de la base.

D'où la stratégie : **restauration par utilisateur = pierres tombales + corbeille + export JSON**. La sauvegarde du fournisseur ne sert qu'au sinistre global.

## 2. Résilience
| Risque | Protection |
|---|---|
| Suppression accidentelle par l'utilisateur | Corbeille de 30 jours (pierres tombales serveur) ; instantanés locaux ; export JSON |
| Erreur locale propagée (bug, import, restauration) | Garde-fou anti-cataclysme (`04` § 3.2) : aperçu obligatoire au-delà de 50 suppressions ou 10 % d'un domaine |
| Base locale corrompue ou effacée | Reprise depuis le cloud (réception complète), puis depuis IndexedDB/localStorage (`recoverSinglesFromIdb` existe) ou depuis un instantané |
| Perte du serveur ou corruption de la base | Restauration de la sauvegarde quotidienne. Les appareils gardent leurs données : **resynchronisation complète avec fusion**, jamais d'écrasement local. RPO : 24 h (Pro) ; les appareils comblent en général l'écart |
| Fournisseur indisponible | Panel continue de fonctionner hors ligne ; l'outbox attend |
| Changement de fournisseur | Postgres standard, export logique, protocole Panel indépendant du fournisseur |
| Intégrité | `contentHash` par fiche ; empreinte globale comparée après migration ; vérification d'intégrité « mes données » à la demande (comptes et empreintes locaux et serveur) |

Procédure d'incident (runbook du lot 3.6) : détection → gel des écritures (`sync_enabled=false` côté serveur, les clients passent en mode local) → diagnostic → restauration → vérification → réouverture → communication. Notification CNIL si nécessaire (§ 4).

## 3. Suppression de compte
- Bouton « Supprimer mon compte » : réauthentification, export proposé, confirmation saisie.
- Une Edge Function (clé de service **côté serveur uniquement**) supprime `auth.users`. La cascade `on delete cascade` efface `profiles`, `user_settings`, `devices`, `copies`, `locations`, `pulls`, `series_follows`, `reading_progress`, `user_guides`, `sync_ops`, `sync_conflicts`, `user_sync_state`.
- **Données personnelles et données globales sont séparées** : aucune table globale (catalogue partagé) n'existe en Phase 3, donc rien de global à anonymiser. Si un catalogue communautaire arrive plus tard, les contributions seront détachées (`contributed_by = null`) et non supprimées.
- Les données locales de l'appareil restent sur l'appareil ; l'utilisateur peut les retirer séparément.
- Les sauvegardes du fournisseur contiennent encore les données jusqu'à leur expiration (7 jours en Pro) : à indiquer dans la politique de confidentialité. Les exports indépendants : 4 semaines au plus.
- Rapport de suppression : confirmation par e-mail, sans contenu.

## 4. RGPD et conformité
### 4.1 Données personnelles traitées (Phase 3)
- Identité de compte : e-mail, mot de passe haché (par Supabase Auth).
- Profil : nom affiché, pseudonyme, bio, langue, marché.
- Collection, wishlist, emplacements, pull list, progression de lecture, guides personnels, préférences.
- Techniques : appareils (nom, plateforme, version), adresses IP et journaux d'authentification (côté fournisseur), horodatages.
- **Aucune** donnée sensible au sens de l'article 9. Une collection peut toutefois révéler des centres d'intérêt : on la traite comme confidentielle par défaut.

### 4.2 Obligations légales identifiées (RGPD) — à confirmer par un juriste
| Exigence | Article | Application à Panel |
|---|---|---|
| Base légale | art. 6 | Exécution du contrat (service de compte et de synchronisation) ; pas de consentement nécessaire pour le cœur du service **[Hyp.]** |
| Information | art. 12 à 14 | Politique de confidentialité claire, avant l'inscription |
| Accès, portabilité | art. 15 et 20 | `export_my_data()` en JSON, depuis l'application |
| Rectification | art. 16 | Édition dans l'application |
| Effacement | art. 17 | Suppression de compte (§ 3) |
| Délai de réponse | art. 12 | **Un mois** (prolongeable de deux) |
| Sous-traitants | art. 28 | DPA Supabase (disponible) ; DPA du fournisseur SMTP et de l'hébergeur web |
| Registre des traitements | art. 30 | À tenir (modèle CNIL) |
| Sécurité | art. 32 | RLS, HTTPS, CSP, stockage chiffré des jetons Android, journalisation, sauvegardes |
| Violation de données | art. 33 et 34 | Notification à la CNIL **sous 72 h** si risque ; information des personnes si risque élevé |
| Transferts hors UE | art. 44 à 49 | Région UE (Paris `eu-west-3` ou Francfort `eu-central-1`) pour la base. **Une région UE ne règle pas tout** : Supabase est une société américaine, et l'hébergeur s'appuie sur AWS. Garanties (clauses contractuelles types, Data Privacy Framework) à vérifier |
| Traceurs (cookies) | directive ePrivacy, lignes directrices CNIL | Jetons de session strictement nécessaires : **exemptés** de consentement **[Hyp.]**. **Aucune mesure d'audience** sans consentement |

### 4.3 Bonnes pratiques (non exigées en tant que telles)
- Minimisation : pas de nom réel requis, pas de date de naissance, pas de téléphone.
- Confidentialité par défaut : tout est privé (`privacy.*`).
- Durées de conservation proposées : comptes inactifs depuis 3 ans → e-mail d'avertissement, puis suppression ; journaux de synchronisation 90 jours ; pierres tombales 90 jours ; `sync_conflicts` résolus 180 jours.
- Journal d'accès administrateur ; principe du moindre privilège sur le tableau de bord du fournisseur (double authentification obligatoire).
- Page « Mes données » : ce qui est stocké où, ce qui est synchronisé, ce qui ne l'est jamais.

### 4.4 À faire valider par un professionnel **avant toute bêta**
1. Politique de confidentialité et conditions d'utilisation.
2. Base légale de chaque traitement.
3. Contrats de sous-traitance (Supabase, SMTP, hébergeur web) et garanties de transfert.
4. Registre des traitements.
5. Durées de conservation.
6. Âge minimum et mineurs (consentement parental en dessous de 15 ans en France).
7. **Conditions d'utilisation de Comic Vine** pour des métadonnées ou URL de couvertures copiées dans des fiches personnelles stockées dans le cloud (le lot 2.5 a établi une licence non commerciale).
8. Statut juridique de l'éditeur de Panel (personne physique ou société) et mentions légales.
9. Procédure de violation de données.

## Sources
- Supabase, sauvegardes et PITR : https://supabase.com/docs/guides/platform/backups
- Supabase, tarifs : https://supabase.com/pricing
- Supabase, DPA et sécurité : https://supabase.com/legal/dpa, https://supabase.com/security
- CNIL, RGPD : https://www.cnil.fr/fr/reglement-europeen-protection-donnees
- CNIL, violations de données : https://www.cnil.fr/fr/notifier-une-violation-de-donnees-personnelles
- CNIL, cookies et traceurs : https://www.cnil.fr/fr/cookies-et-autres-traceurs
- CNIL, registre : https://www.cnil.fr/fr/RGPD-le-registre-des-activites-de-traitement
