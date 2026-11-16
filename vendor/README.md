# Bibliothèques tierces servies par Panel

Fichiers téléchargés une fois, en version figée, depuis le registre officiel npm. Jamais chargés depuis un CDN par l'application.
Toute mise à jour passe par une nouvelle décision (`docs/DECISIONS.md`) et une nouvelle vérification d'empreinte.

| Fichier | Paquet | Source | Intégrité du paquet (registre npm) | SHA-256 du fichier | Licence |
|---|---|---|---|---|---|
| `supabase-js-2.118.0.js` | `@supabase/supabase-js` 2.118.0 (publié le 15 octobre 2026), fichier `dist/umd/supabase.js`, 218 252 octets | `npm pack @supabase/supabase-js@2.118.0` | `sha512-FxI8UXMVC2UG7IkeiI8fuQZqq2oI3JeSuN8MPIC2RLVaoEAxKS0nqE6kii9Ewpq8f9gNPM6git1Y8f0vN/QLFw==` (vérifiée le 16 novembre 2026) | `7jvo3hkrl8sdc9HpXWuCux9rZYwPl8TvdX/DMZlu09M=` | MIT (`supabase-js-2.118.0.LICENSE.txt`) |
| `jszip-3.10.1.min.js` | `jszip` 3.10.1, fichier `dist/jszip.min.js`, 97 630 octets | `npm pack jszip@3.10.1` (identique octet pour octet à l'ancienne copie cdnjs) | `sha512-xXDvecyTpGLrqFrvkrUSoxxfJI5AH7U8zxxtVclpsUtMCq4JQ290LY8AW5c7Ggnr/Y/oK+bQMbqK2qmtk3pN4g==` | hex `acc7e41455a80765b5fd9c7ee1b8078a6d160bbbca455aeae854de65c947d59e` | MIT ou GPL-3.0 au choix (`jszip-3.10.1.LICENSE.md`) |
| `zxing-wasm-3.1.3/iife/reader/index.js` | `zxing-wasm` 3.1.3, `dist/iife/reader/index.js`, 38 049 octets | `npm pack zxing-wasm@3.1.3` (identique à l'ancienne copie jsDelivr) | `sha512-3lC9BJk4fR5ZJxcGjb0hVnDFOW7KpLXHIebiBmVd4FDRQZVeObztoTKxRUPxlWwSgxrMRONK0u50hBD1aTYEKg==` | hex `98e44c8063b9aa75b31562f6b64b2cead420842ac3e4f57a791c01cd8f450a7a` | MIT (`zxing-wasm-3.1.3/LICENSE.txt`) |
| `zxing-wasm-3.1.3/reader/zxing_reader.wasm` | même paquet, `dist/reader/zxing_reader.wasm`, 1 093 289 octets | idem | idem | hex `2ebda08a93eea3efcd8399cda6b276e6a0b1de4fec60b4d8988a047de4c6d1ba` | MIT |

Contrôles faits avant intégration : aucun `eval`, aucun `new Function`, aucun chargement dynamique, aucune adresse tierce appelée (compatible avec la CSP de D-83).
Chargement : à la demande, seulement quand un projet en ligne est configuré sur l'appareil (Réglages › Compte & profil).

JSZip et zxing-wasm (stabilisation S6, 16 novembre 2026) : servis par Panel depuis ce dossier au lieu de cdnjs et jsDelivr ; la CSP n'autorise plus aucun CDN. Les empreintes sont aussi contrôlées par `android-app/vendor.lock.json` à chaque construction Android.
