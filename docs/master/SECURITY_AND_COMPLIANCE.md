# Sécurité et conformité — Belgique et Union européenne (D-111)

> **Avertissement.** Ce document **n'est pas un avis juridique**. Il range les sujets pour préparer le travail avec un avocat belge et un comptable. Aucune obligation n'y est inventée : chaque ligne indique sa nature et le niveau de certitude. Les détails techniques existants sont dans [prd/PANEL_SECURITY_AND_COMPLIANCE](../prd/PANEL_SECURITY_AND_COMPLIANCE.md) et [panel-2/PANEL_2_SECURITY_GOVERNANCE](../panel-2/PANEL_2_SECURITY_GOVERNANCE.md) ; ils ne sont pas recopiés ici.

Légende :
- **Certain** : obligation qui s'applique à Panel dès qu'il traite des données personnelles ou ouvre des comptes.
- **Conditionnel** : dépend de la taille, du modèle ou des choix de Panel.
- **Bonne pratique** : non exigée telle quelle ; recommandée.
- **⚖ Avocat** / **€ Comptable** : à faire valider.

## 1. Matrice

| Sujet | Texte | Nature | Ce que Panel fait déjà | À faire |
|---|---|---|---|---|
| Données personnelles | RGPD (Règlement (UE) 2016/679) ; loi belge du 30 juillet 2018 | Certain dès l'ouverture des comptes | Local par défaut ; export et effacement (migrations 9 et 12) ; aucune donnée de collection dans les publications (`payload_ok`) | Registre des traitements, politique de confidentialité, base légale par traitement ⚖ |
| Âge du consentement numérique | RGPD art. 8 ; la Belgique a retenu **13 ans** (loi du 30/07/2018) — ⚖ à confirmer | Certain si le consentement est la base légale | Refus sous 13 ans ; tranche d'âge seulement, pas de date de naissance conservée | Choix de la base légale pour les 13-17 ans ⚖ |
| Analyse d'impact (AIPD) | RGPD art. 35 | Conditionnel (très probable : mineurs et réseau social) | — | AIPD avant ouverture aux mineurs ⚖ |
| Autorité de contrôle | Autorité de protection des données (APD) | Certain | — | Contact, procédure de violation de données (72 h, art. 33) |
| Plateformes en ligne | DSA (Règlement (UE) 2022/2065) | Conditionnel : certaines obligations (art. 20 à 28) ne s'appliquent pas aux micro et petites entreprises (art. 19) ⚖ | Signalement, décision motivée, appel, journal (migrations 13, 16, 17) | Point de contact (art. 11-12), conditions générales claires (art. 14), signalement (art. 16) et motivation (art. 17) — à confirmer ⚖ |
| Protection des mineurs en ligne | DSA art. 28 et lignes directrices de la Commission | Conditionnel (voir art. 19) ; appliqué **comme bonne pratique** quoi qu'il arrive | Panel Guardian (migration 18) ; profils mineurs privés ; adultes et mineurs séparés ; jamais de publicité pour les mineurs | ⚖ |
| Droit d'auteur | Code de droit économique, livre XI ; directive (UE) 2019/790 | Certain (contenus des membres, images, textes) ; art. 17 de la directive conditionnel (taille) ⚖ | Aucune image non vérifiée présentée comme officielle ; « plan de fan » ; © des éditeurs ; J'aime dessinés originaux | Revue par un juriste en propriété intellectuelle avant lancement commercial |
| Marques | Marques des éditeurs | Certain | Note de non-affiliation dans Légal & sécurité (D-111) | ⚖ |
| Consommateurs (abonnement) | Directive 2011/83/UE ; Code de droit économique, livre VI | Conditionnel (si Panel+ est vendu) | Rien n'est vendu | Rétractation de 14 jours, information précontractuelle, résiliation simple ⚖ |
| Cookies et traceurs | Directive ePrivacy ; loi belge télécoms | Conditionnel | Aucun traceur tiers ; stockage local technique | Vérifier à l'ouverture ⚖ |
| Accessibilité | Acte européen sur l'accessibilité (directive (UE) 2019/882) | Conditionnel (micro-entreprises de services exemptées) ⚖ | Tests d'accessibilité dans la suite Edge | Bonne pratique : WCAG 2.2 AA |
| Fiscalité et TVA | — | Certain dès un revenu | — | € Comptable : statut, TVA, plateformes de paiement |
| Identité de l'éditeur | Code de droit économique, livre XII (informations du prestataire) | Certain dès la mise en ligne | — | Nom, adresse, BCE `[À COMPLÉTER]` |

## 2. Panel Guardian

### 2.1 Règles

1. **Aucun compte de moins de 13 ans**, même avec l'accord d'un parent (`too_young`, migration 13).
2. **13-17 ans**, en deux tranches :
   - profil jamais public ;
   - aucun contact avec un adulte : les adultes ne voient pas les mineurs et les directs sont séparés ;
   - contenus pour adultes masqués ;
   - jamais de publicité.
3. **Seuils configurables par pays** :
   - les tranches sont fixées dans la fonction `community_join` ;
   - un pays au seuil différent exigera une table `guardian.country_rules` ;
   - statut **PLANNED**, à créer seulement quand Panel ouvrira hors de Belgique.
4. **Statut d'âge** : `unverified`, `verified_13_15`, `verified_16_17`, `verified_adult`, `under_13_blocked`, `review_required`.
   - L'âge déclaré reste `unverified` : il n'est jamais présenté comme vérifié.
   - Seul un prestataire futur (rôle service) ou l'équipe peut changer ce statut.
5. **Contestation** : examinée par un humain de l'équipe en double authentification.
   - Si la demande vise une tranche plus âgée, les directs sont suspendus pendant l'examen.
6. **Espace parental** :
   - le lien est créé par le mineur, avec un code à usage unique valable 48 h et stocké haché ;
   - il est accepté par un adulte en double authentification ;
   - un mineur a au plus 2 parents reliés ;
   - le parent règle les heures calmes, les directs et les abonnements ;
   - le parent **ne voit ni les publications privées, ni les messages, ni les directs** ;
   - le lien est révocable par le parent, par le jeune devenu majeur ou par l'équipe.
7. **Restrictions de compte** :
   - elles sont proportionnées et datées (1 à 365 jours) ;
   - elles sont motivées et levables ;
   - un membre de l'équipe ne peut pas en poser une sur son propre compte.
8. **Politique côté serveur** :
   - `guardian.evaluate` est appliquée par des déclencheurs sur les publications, les abonnements, les salons et les messages de direct ;
   - l'application ne fait qu'afficher le résultat (`api.guardian_can`).
9. **Ce que Guardian ne fait pas** :
   - aucune biométrie ;
   - aucune reconnaissance faciale ;
   - aucune lecture de messages ;
   - aucune géolocalisation.

### 2.2 Tests obligatoires (tous verts, PGlite)

| Test du méga-prompt | Test |
|---|---|
| Inscription à 12 ans bloquée | `moins de 13 ans : inscription refusée, aucune trace conservée` |
| Lien parental frauduleux | `lien parental : … code obligatoire …` et `lien frauduleux : un inconnu ne règle rien …` |
| Adulte inconnu qui invite un mineur en direct | `directs : … un adulte inconnu ne peut pas inviter un mineur` (+ `cohosts.test.js`) |
| Révocation | `révocation : par le parent …` |
| Suppression de compte | `suppression du compte : liens, réglages, statut et journal Guardian partent avec lui` |

**Appliquée en préproduction** le 22/11/2026 (D-116), avec les migrations 16 à 21. Les tests ci-dessus tournent en local (PGlite) ; aucun parcours n'a encore été essayé avec de vrais comptes, l'ouverture des comptes (S8) restant fermée.

## 3. Squelettes juridiques

À compléter par l'éditeur et à faire valider par un avocat belge. Ces textes ne sont **pas publiés** dans l'application tant qu'ils ne sont pas validés.

### 3.1 Conditions générales d'utilisation (squelette)

1. **Éditeur** :
   - nom `[À COMPLÉTER]` ;
   - forme juridique `[À COMPLÉTER]` ;
   - siège `[À COMPLÉTER]` ;
   - BCE `[À COMPLÉTER]` ;
   - contact `[À COMPLÉTER]`.
2. **Objet** : application de collection de comics et réseau social associé.
3. **Âge** :
   - 13 ans minimum ;
   - règles particulières pour les 13-17 ans ;
   - espace parental.
4. **Compte** :
   - facultatif ;
   - l'utilisation locale ne demande pas de compte ;
   - sécurité, double authentification pour l'équipe.
5. **Contenus des membres** :
   - licence accordée à Panel `[À COMPLÉTER ⚖]` ;
   - interdits ;
   - droit d'auteur.
6. **Modération** :
   - signalement ;
   - décisions motivées ;
   - recours interne ;
   - délais `[À COMPLÉTER]`.
7. **Mesures** : masquage, restriction, suspension. Elles sont proportionnées.
8. **Non-affiliation** : Panel n'est affilié à aucun éditeur. Les marques citées appartiennent à leurs titulaires.
9. **Responsabilité** `[À COMPLÉTER ⚖]`.
10. **Droit applicable et juridiction** : droit belge `[À COMPLÉTER ⚖]`.
11. **Modification des conditions** : préavis `[À COMPLÉTER]`.

### 3.2 Politique de confidentialité (squelette)

1. **Responsable du traitement** `[À COMPLÉTER]` ; DPO éventuel `[À COMPLÉTER]`.
2. **Données sur l'appareil**, qui ne sont pas transmises : collection, prix, cote, emplacement, notes, lecture.
3. **Données en ligne**, seulement si un compte existe :
   - pseudo ;
   - tranche d'âge (pas la date de naissance) ;
   - publications ;
   - signalements ;
   - journal de sécurité.
4. **Finalités et bases légales** `[À COMPLÉTER ⚖]`.
5. **Mineurs** : Panel Guardian, droits des parents (limités aux réglages).
6. **Destinataires et sous-traitants** : hébergeur `[À COMPLÉTER]`, localisation UE `[À COMPLÉTER]`.
7. **Durées de conservation** : voir [DATA_GOVERNANCE](DATA_GOVERNANCE.md) `[À COMPLÉTER ⚖]`.
8. **Droits** : accès, rectification, effacement, portabilité, opposition. Plainte possible auprès de l'APD.
9. **Sécurité** : chiffrement en transit, RLS, double authentification de l'équipe.

### 3.3 Règles de la communauté (squelette)

- Respect.
- Aucun harcèlement.
- Aucun contenu sexuel impliquant des mineurs (signalé aux autorités `[À COMPLÉTER ⚖ : procédure]`).
- Spoilers signalés.
- Aucune vente de contrefaçons.
- Aucune donnée personnelle d'autrui.
- Partenaires étiquetés.

### 3.4 Charte parentale (squelette)

- Ce que le parent peut régler.
- Ce qu'il ne peut pas voir.
- Comment révoquer le lien.
- Ce qui se passe à 18 ans `[À COMPLÉTER]`.

## 4. Sécurité technique (rappel, sans doublon)

- RLS sur toutes les tables.
- Fonctions `security definer` avec `search_path` vide.
- Équipe en double authentification (`app.mfa_ok`, migration 17).
- Limitation de débit (`community.rate_check`).
- CSP par empreintes (`sync-domains`).
- `check:secrets` sur chaque commit : aucun secret dans le dépôt, `.secrets/` et `.cache/` jamais versionnés.

## 5. Marché, messages privés, profils pros, forum (D-113)

> Même avertissement : rien ici n'est un avis juridique. Chaque ligne est à faire valider (⚖ / €) avant d'ouvrir ces espaces.

| Sujet | Texte | Nature | Ce que Panel prépare | À faire |
|---|---|---|---|---|
| Traçabilité des vendeurs professionnels | DSA art. 30 (places de marché) | Conditionnel (taille, art. 29) ; bonne pratique sinon | Statut « professionnel » prévu ; aucune donnée d'identité stockée dans la migration 19 | Collecte et vérification des informations du vendeur pro ⚖ |
| Information sur le statut du vendeur | Directive (UE) 2019/2161 (« Omnibus ») modifiant la directive 2011/83/UE | Certain pour une place de marché | Mention « vendeur particulier / professionnel » prévue sur l'annonce | Textes d'information ⚖ |
| Droits du consommateur (achat à un professionnel) | Directive 2011/83/UE ; Code de droit économique, livre VI | Certain si le vendeur est professionnel | — | Droit de rétractation, garanties ⚖ |
| Déclaration des revenus des vendeurs | DAC7 (directive (UE) 2021/514) | Certain pour un opérateur de plateforme, sous les seuils prévus | — | Procédure de collecte et de déclaration € ⚖ |
| Détention des fonds des acheteurs | DSP2 (directive (UE) 2015/2366) | Certain si Panel encaissait pour autrui | Panel ne détient jamais l'argent : tout passe par un prestataire agréé (choix `[À FAIRE]`) | Contrat du prestataire ⚖ € |
| Abonnements | Directive 2011/83/UE ; Code de droit économique | Certain dès la vente | Aucun prix affiché (« Tarif à venir ») ; résiliation en un clic prévue | Conditions de vente ⚖ |
| Confidentialité des messages | RGPD ; directive 2002/58/CE (vie privée et communications électroniques) | Certain | Chiffrement de bout en bout (ECDH P-256, HKDF, AES-GCM 256) : le serveur ne garde que du texte chiffré, l'heure et les identifiants ; clé privée non exportable | AIPD sur les messages ⚖ |
| Signalement d'un message | DSA (signalement et recours) | Bonne pratique | Seuls les messages choisis par la personne qui signale sont transmis, en clair, à l'équipe (`messaging.reports`) | Délais de traitement écrits |
| Mineurs et messages | DSA art. 28 ; RGPD art. 8 | Bonne pratique appliquée strictement | Aucun message entre mineur et adulte (refusé côté serveur, `messaging.can`) ; messages privés réservés aux adultes à l'ouverture | — |
| Vérification des pros (sceau Encré) | RGPD (minimisation) | Certain | Aucun justificatif stocké ; seule la décision motivée reste au journal | Procédure d'examen ⚖ |
| Forum (Le Comptoir) | DSA (modération, motivation des décisions) | Conditionnel | Contenu adulte caché aux mineurs ; signalements (`forum.reports`) ; Guardian couvre aussi sujets et réponses | — |

### 5.1 Limites connues, écrites

- Les messages n'ont pas encore de **confidentialité persistante** à chaque message (protocole à double cliquet) : RESEARCH.
- L'empreinte de sécurité (12 groupes de 5 chiffres) se compare de vive voix ; Panel ne la vérifie pas à la place des personnes.
- Le marché reste **fermé** tant que `market.settings.fee_rate` est vide et qu'aucun prestataire n'est choisi.

### 5.2 Tests (PGlite, `backend/tests/pros-market.test.js`, 8 tests verts)

- Profil pro refusé aux mineurs ; sceau seulement après décision d'un membre de l'équipe en double authentification ; retrait du sceau.
- Annonce refusée si le marché est fermé, si le vendeur est mineur, ou si elle contient des coordonnées ou un paiement hors de Panel.
- Étapes de vente : chaque action par la bonne personne ; remise en main propre par code.
- Messages : demande avant échange, refus entre mineur et adulte, texte en clair refusé par le serveur, chiffrement réel avec `dm-core`.

## 6. Messages façon Signal, comptes et vérification (D-114)

| Sujet | Règle | Où |
|---|---|---|
| Échange de clés | X3DH sur P-256 : clé d'identité, préclé signée (ECDSA SHA-256, vérifiée avant usage), préclé à usage unique retirée du serveur dès qu'elle est donnée | `domains/community/dm-ratchet.js`, `api.dm_bundle_publish`, `api.dm_bundle_get` |
| Messages | Double cliquet : chaque message a sa clé ; en-tête `{dh, pn, n}` authentifié comme donnée associée ; remplissage ISO 7816-4 par 64 octets ; rejeu refusé ; 1 000 clés sautées au plus | `dm-ratchet.js`, `messaging.box2_ok` |
| Éphémères | 0, 5 min, 1 h, 1 jour, 1 semaine par conversation ; message échu jamais servi ; purge par le rôle service | `api.dm_timer_set`, `api.dm_send2`, `messaging.purge_expired` |
| Métadonnées | Panel voit qui écrit à qui et quand ; pas d'« expéditeur scellé » pour l'instant (écrit comme limite) | §5.1 |
| Connexion | Apple et Google en OAuth (PKCE) ; lien de connexion par e-mail au message neutre (ne révèle pas si le compte existe) ; mot de passe de 12 caractères au moins ; TOTP | `domains/account/auth-core.js`, `backend/supabase/config.toml` |
| Inscription | Pseudo 3 à 24 caractères ; noms d'équipe et de grandes maisons réservés jusqu'à vérification ; 13 ans au moins ; comptes pros réservés aux adultes ; consentement aux conditions obligatoire, nouveautés facultatives | `signupProfile` |
| Vérification | Pièces par type ; contrôles BCE, SIREN, ISBN-13, domaine ; empreintes SHA-256 seulement (jamais les fichiers) ; examen en double authentification, jamais sur soi-même ; pièces effacées 30 jours après la décision ; pastille valable 365 jours | `domains/community/verify-core.js`, `api.verify_submit`, `api.verify_review`, `pro.verify_purge` |
| Marché | Offres de 60 % au moins, 48 h ; avis seulement par l'acheteur d'une vente terminée, sans coordonnées ; réputation bayésienne | `api.offer_make`, `api.offer_respond`, `api.review_leave`, `api.seller_reputation` |
| Panel+ | Droit lu dans les abonnements actifs, écrits par le rôle service seulement ; un abonnement n'achète jamais de visibilité ni de pastille | `api.my_entitlements` |

### 6.1 À faire valider avant l'ouverture

- Conservation des pièces d'identité (30 jours) et base légale : à valider avec un avocat (RGPD art. 6 et 9, minimisation).
- Vérification des maisons d'édition hors Belgique et France : contrôle humain, registre à préciser pays par pays.
- Connexion Apple : exigences de l'App Store (connexion Apple proposée dès qu'un autre fournisseur l'est) à vérifier pour l'application mobile.

### 6.2 Tests (PGlite, `backend/tests/signal-verify.test.js`, 4 tests verts)

Préclé à usage unique donnée une seule fois ; échange X3DH et double cliquet de bout en bout sans texte clair côté serveur ; enveloppe non conforme refusée ; minuteur et purge ; contrôles BCE, domaine, ISBN ; examen refusé sans double authentification ; pastille expirée après un an ; empreintes purgées ; offres trop basses, trop nombreuses ou au prix refusées ; acceptation qui réserve au prix de l'offre et refuse les autres ; avis unique sans coordonnées ; droits Panel+ selon l'abonnement.
