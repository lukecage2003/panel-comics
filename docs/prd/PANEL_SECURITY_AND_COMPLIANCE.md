# PANEL — Sécurité et conformité

Date : 13 novembre 2026. Statut : proposé (D-58). Ce document s'appuie sur [`phase3/05-sauvegardes-confidentialite.md`](../phase3/05-sauvegardes-confidentialite.md), [`phase3/runbooks/`](../phase3/runbooks/) et les migrations 7, 9, 10 et 12. **Il ne constitue pas un avis juridique** : les points marqués « avis requis » doivent être validés par un juriste avant la bêta publique.

## 1. Principes

1. Minimisation : on ne collecte que ce qui sert une fonction.
2. Local d'abord : la collection reste sur l'appareil tant que l'utilisateur ne synchronise pas.
3. Privé par défaut : `privacy.profile_public = false` (migration 2, existant).
4. Données financières, valeurs, emplacements, notes : **jamais publiques**, jamais transmises à un tiers.
5. Défense en profondeur : RLS + RPC contrôlées + validation client + limites de débit.

## 2. RGPD

| Exigence | Mise en œuvre | État |
|---|---|---|
| Base légale | Contrat (compte, synchronisation) ; consentement (analytics, e-mails marketing, profil public, push) ; intérêt légitime (sécurité, anti-abus) | [Proposé] |
| Registre des traitements | Document tenu par l'éditeur de PANEL | [Proposé] (avis requis) |
| Information | Politique de confidentialité en français, couche courte + détaillée | [Proposé] (avis requis) |
| Droit d'accès et portabilité | `api.export_my_data()` (JSON) + exports Collection CSV/JSON | [Impl. local] / [Existant] |
| Droit à l'effacement | `api.delete_my_data`, Edge Function `delete-account`, purge planifiée | [Impl. local] |
| Rectification | Profil et données modifiables | [Impl. local] |
| Opposition / retrait du consentement | Réglages, effet immédiat | [Proposé] |
| Conservation | Tombes 90 jours, notifications 90 jours, journaux techniques 12 mois, décisions de modération 6 ans (sans contenu personnel au-delà du nécessaire) | [Partiel] (purge 90 jours existante) |
| Sous-traitants | Supabase (UE), Cloudflare (R2, Pages), Stripe, fournisseur e-mail UE, FCM ; DPA signés | [Proposé] |
| Transferts hors UE | Limiter ; clauses contractuelles types si nécessaire (Stripe, Google FCM) | Avis requis |
| AIPD | Recommandée avant le lancement public (profilage Comic DNA, mineurs possibles) | [Proposé] |
| Violation de données | Runbook [`incident.md`](../phase3/runbooks/incident.md) ; notification CNIL sous 72 h | [Existant] (runbook) |

## 3. Consentement

- Bandeau de consentement **sans dark pattern** : « Refuser » aussi visible qu'« Accepter » ; aucune mesure d'audience non exemptée avant consentement.
- Consentements granulaires stockés dans `app.user_settings.privacy` avec date et version du texte.
- Comic DNA et Collection Match : **opt-in** explicite (profilage).
- Inscription : acceptation des CGU et de la politique de modération ; âge minimum (Q7, 15 ans proposé, art. 45 loi Informatique et Libertés) — avis requis.

## 4. Gestion des données personnelles

| Donnée | Sensibilité | Stockage | Visibilité |
|---|---|---|---|
| E-mail, mot de passe (haché par Supabase Auth) | Élevée | `auth.users` | Jamais publique |
| Pseudo, avatar, bio | Faible | `app.profiles` | Selon visibilité |
| Collection, emplacements, finances, notes | Élevée (patrimoine, adresse implicite) | Appareil ; `app.*` si synchronisée | **Jamais publique** ; copie filtrée seulement |
| Lectures, critiques | Moyenne | `app.reading_states`, `community.post` | Lectures privées par défaut ; critiques selon visibilité |
| Adresse IP, appareil | Moyenne | Journaux techniques, `app.devices` | Jamais publique |
| Paiement | Élevée | **Stripe uniquement** ; PANEL ne stocke aucune donnée de carte | — |

Images téléversées : métadonnées EXIF (GPS) retirées avant stockage.

## 5. Suppression de compte

Parcours : demande → réauthentification → choix (anonymiser ou retirer mes publications) → délai de grâce de 30 jours (annulable) → `app.delete_account` → confirmation par e-mail. Les abonnements Stripe sont annulés automatiquement. Les décisions de modération sont conservées sous forme pseudonymisée lorsque la loi l'exige.

## 6. DSA (Digital Services Act)

PANEL est une **plateforme en ligne** (hébergement de contenus publiés au public). Obligations proportionnées à une micro ou petite entreprise (exemptions de l'article 19 à vérifier) — **avis requis**.

| Obligation | Mise en œuvre |
|---|---|
| Point de contact unique (art. 11-12) | Adresse publiée dans les mentions légales |
| Conditions générales claires (art. 14) | CGU incluant la politique de modération et les outils automatisés utilisés |
| Mécanisme de notification et d'action (art. 16) | Bouton « Signaler » sur chaque contenu et profil, accessible sans compte pour les contenus illicites (formulaire) |
| Exposé des motifs (art. 17) | Champ `moderation.decision.statement` obligatoire, envoyé à l'auteur |
| Réclamation interne (art. 20) | `moderation.appeal`, traité par une autre personne, délai 6 mois |
| Signaleurs de confiance (art. 22) | Priorité dans la file si désignés |
| Mesures contre les abus (art. 23) | Suspension des comptes abusifs et des signalements manifestement infondés |
| Transparence (art. 15, 24) | Rapport annuel : nombre de signalements, délais, décisions, appels |
| Protection des mineurs (art. 28) | Pas de publicité ciblée, paramètres privés par défaut |
| Pas de dark patterns (art. 25) | Revue UX avant lancement |

## 7. Modération, signalements, blocage

- **Automatique** : limites de débit (`policy-core.LIMITS`, `app.service_limits`) ; liens interdits pour les comptes de moins de 7 jours ; filtre de mots (liste éditable) ; détection de doublons (spam) ; score de signalements.
- **Humaine** : file priorisée (illégal et données personnelles d'abord), décision motivée, journal inaltérable, appel par une autre personne. Objectif : contenus illégaux traités en < 24 h, autres en < 72 h.
- **Blocage** : invisibilité réciproque, suppression des abonnements, impossibilité de commenter ou mentionner.
- **Masquage** : utilisateurs ou mots, durée choisie.
- **Spoilers** : signalement « spoiler » → floutage plutôt que retrait.

## 8. Prévention du spam et des abus

CAPTCHA à l'inscription et au-delà de seuils ; vérification d'e-mail avant de publier ; quotas par heure et par jour ; limitation par IP sur l'authentification ; détection de comptes en rafale ; pas de liens les 7 premiers jours ; mentions limitées à 5 par publication ; réactions limitées en débit.

## 9. Sécurité des API et contrôle des accès

| Mesure | Détail | État |
|---|---|---|
| RLS sur toutes les tables | `user_id = auth.uid()` ; politiques de visibilité pour la communauté | [Impl. local] (migration 5) |
| RPC durcies | `SECURITY DEFINER`, `search_path` fixé, droits `execute` révoqués pour `public` | [Impl. local] (migration 7) |
| Rôles du personnel | `app.staff_roles`, `has_role()`, journal | [Impl. local] (migration 10) |
| Secrets | Jamais dans le dépôt (`npm run check:secrets`) ; clé `service_role` uniquement dans les Edge Functions | [Existant] |
| Webhooks | Signature Stripe vérifiée, idempotence | [Proposé] |
| Téléversements | URL signées R2 à durée courte, type et taille vérifiés | [Proposé] |
| En-têtes | CSP stricte (aucun script tiers non listé), HSTS, `X-Content-Type-Options`, `Referrer-Policy` | [Proposé] (lot 3.2) |
| Android | Stockage sécurisé des jetons, `allowBackup` réglé, signature de publication | [Bloqué] (lot 3.2) |
| Dépendances | Bibliothèques verrouillées (`vendor.lock.json`), revue avant mise à jour | [Existant] |
| Tests de sécurité | Tests RLS et rôles (PGlite), contrôle des frontières ; audit externe avant V1 publique | [Partiel] |

## 10. Droits sur les couvertures et médias

| Cas | Règle |
|---|---|
| Couvertures officielles | Protégées par le droit d'auteur ; **non affichées publiquement** sans licence ; `catalog.cover.license` |
| Photos personnelles de l'utilisateur | Visibles par lui seul par défaut ; publiables par lui (il garantit ses droits dans les CGU) ; retrait sur notification |
| Images d'Explorer | Uniquement autorisées (D-48 à D-52) ; sinon remplacement typographique |
| Courte citation, critique | Droit de citation (texte) ; pas de reproduction de planches entières |
| Contenus tiers (actualités) | Titre + résumé rédigé par PANEL + lien sortant (D-54 § 14) |
| Notification de contrefaçon | Formulaire dédié, retrait rapide, contre-notification |

## 11. Licences de données et de code

- Code GPL (Metron, GCD, Mylar) : **concepts seulement**, aucun code copié (D-54 § 7).
- Données GCD (CC BY-SA 4.0) : partage à l'identique d'une base dérivée — avis requis avant usage public.
- Comic Vine : usage non commercial, clé personnelle de l'utilisateur seulement.
- Polices : Barlow Condensed (OFL), fournie avec sa licence (`fonts/OFL.txt`).

## 12. Paiements

Stripe Checkout et portail client (PCI-DSS délégué) ; SCA (DSP2) gérée par Stripe ; TVA UE (Stripe Tax recommandé) ; droit de rétractation de 14 jours pour les services numériques (renonciation expresse si exécution immédiate) — avis requis ; factures disponibles dans le portail.
