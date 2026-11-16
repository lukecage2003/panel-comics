# Bibliothèques tierces servies par Panel

Fichiers téléchargés une fois, en version figée, depuis le registre officiel npm. Jamais chargés depuis un CDN par l'application.
Toute mise à jour passe par une nouvelle décision (`docs/DECISIONS.md`) et une nouvelle vérification d'empreinte.

| Fichier | Paquet | Source | Intégrité du paquet (registre npm) | SHA-256 du fichier | Licence |
|---|---|---|---|---|---|
| `supabase-js-2.118.0.js` | `@supabase/supabase-js` 2.118.0 (publié le 15 octobre 2026), fichier `dist/umd/supabase.js`, 218 252 octets | `npm pack @supabase/supabase-js@2.118.0` | `sha512-FxI8UXMVC2UG7IkeiI8fuQZqq2oI3JeSuN8MPIC2RLVaoEAxKS0nqE6kii9Ewpq8f9gNPM6git1Y8f0vN/QLFw==` (vérifiée le 16 novembre 2026) | `7jvo3hkrl8sdc9HpXWuCux9rZYwPl8TvdX/DMZlu09M=` | MIT (`supabase-js-2.118.0.LICENSE.txt`) |

Contrôles faits avant intégration : aucun `eval`, aucun `new Function`, aucun chargement dynamique, aucune adresse tierce appelée (compatible avec la CSP de D-83).
Chargement : à la demande, seulement quand un projet en ligne est configuré sur l'appareil (Réglages › Compte & profil).
