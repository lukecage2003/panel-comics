# Phase 3 — Dossier de conception

Rédigé le 7 novembre 2026. Lot 3.1 livré le 8 novembre 2026 (fondations backend, sans service externe) ; les lots 3.2 à 3.7 ne sont pas commencés.

| Document | Contenu |
|---|---|
| [`01-audit-technique.md`](01-audit-technique.md) | Audit de l'existant : architecture, données, hors ligne, sauvegardes, sécurité, tests |
| [`02-architecture-cible.md`](02-architecture-cible.md) | Comparaison des options, architecture recommandée, domaines, flux, environnements, coûts, sources |
| [`03-authentification-profils.md`](03-authentification-profils.md) | Authentification, sessions, appareils, modèle de profil |
| [`04-synchronisation.md`](04-synchronisation.md) | Moteur local-first : entités, protocole, conflits, migration, multi-appareils |
| [`05-sauvegardes-confidentialite.md`](05-sauvegardes-confidentialite.md) | Sauvegardes, résilience, suppression de compte, RGPD (pas un avis juridique) |
| [`06-roadmap-phase3.md`](06-roadmap-phase3.md) | Lots 3.1 à 3.7, dépendances, risques transverses |
| [`07-lot-3.1-cahier-des-charges.md`](07-lot-3.1-cahier-des-charges.md) | Spécification du lot 3.1 et critères d'acceptation mesurables |
| [`08-lot-3.1-prompt.md`](08-lot-3.1-prompt.md) | Prompt d'exécution du lot 3.1 (exécuté) |
| [`09-audit-cloture-lot-3.1.md`](09-audit-cloture-lot-3.1.md) | Audit de clôture du lot 3.1 : défauts corrigés (migration 7), révisions, sauvegarde, procédure Supabase, risques |
| [`10-dossier-lots-3.2-3.7.md`](10-dossier-lots-3.2-3.7.md) | Dossier technique des lots 3.2 à 3.7 : portes, environnements, décisions T1 à T4, contrats de synchronisation, scénarios de validation |
| [`runbooks/`](runbooks/) | Procédures : migrations, secrets, sauvegarde et restauration, retour arrière du lot 3.1 |

Légende employée : **[Fait]** constaté dans le code · **[Doc]** documentation officielle · **[Hyp.]** hypothèse · **[Reco.]** recommandation · **[À valider]** décision de l'utilisateur.
