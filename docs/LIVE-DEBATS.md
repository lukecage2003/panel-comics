# Débats en direct : cahier des charges (D-61)

Statut : **studio de préparation construit (D-78), salon à plusieurs non construit.** Le direct à plusieurs demande des comptes en ligne et un serveur audio : il arrive après la phase 1 (service de comptes). Aucun salon, participant ni réaction d'autrui n'est simulé en attendant.

## Déjà disponible : le studio de direct (D-78, onglet Communauté → Directs)

- **Préparer** un direct : sujet, format (débat du mercredi, procès d'un event, meilleur run, club de lecture, sujet libre), date prévue, ordre du jour (huit points au plus), images du tableau (vingt-quatre au plus : couvertures de la collection, par référence, et jusqu'à seize pages choisies dans la galerie du téléphone, D-79) et règles du salon (quatre règles proposées, modifiables).
- **Répéter seul**, en plein écran : chronomètre général et chronomètre du point en cours, ordre du jour coché au fil de l'eau, couverture ou page montrée en grand avec son crédit ou sa légende (zoom, flèches du clavier, balayage, page « spoiler » floutée jusqu'à ce qu'on la révèle), onomatopées de l'utilisateur, test du micro (niveau seulement : rien n'est enregistré ni envoyé).
- **Après la répétition** : synthèse gardée sur l'appareil (durée, points traités et leur durée, images montrées) et planche de synthèse préparée dans le compositeur de planches, comme brouillon local.
- Données : `panel_live_v1` (validé à la lecture par `domains/community/live-core.js`) ; suppression annulable.
- **Pages de la galerie (D-79)** : le bouton « Pages de ma galerie » ouvre la galerie du téléphone (plusieurs images à la fois). Chaque page est réduite à 1 600 px, stockée dans une base IndexedDB à part (`panel-live`, magasin `pages`) et n'est jamais envoyée ni publiée. `panel_live_v1` ne garde qu'une référence, une légende et le drapeau « spoiler ». La planche de synthèse cite le nombre de pages commentées, jamais leur image. Les pages qui ne servent plus à aucun direct ni synthèse sont libérées à la session suivante (l'annulation d'une suppression reste possible d'ici là).
- **En plein direct (D-80)** : la tuile « + Galerie » du tableau, le glisser-déposer sur l'écran ou le collage (Ctrl+V) ajoutent des pages pendant la répétition ; elles rejoignent le tableau du direct et s'affichent aussitôt. Mêmes règles : stockage sur l'appareil seulement, plafond de seize pages.
- **Dans le fil** : le prochain direct daté est rappelé en tête (« Répéter », « Mes directs »).
- **Règle d'usage affichée** : montrer des pages de numéros que l'on possède, pour en débattre ; quelques pages, pas un numéro entier.

## Ce que l'utilisateur obtient

- **Salons vocaux** autour d'un sujet : débat du mercredi sur les sorties, procès d'un événement, « meilleur run de… », club de lecture.
- **Trois rôles** :
  - l'animateur ouvre le salon, donne la parole et modère ;
  - les intervenants parlent après avoir levé la main ;
  - les auditeurs écoutent et réagissent en onomatopées (POW!, WOW!…).
- **Tableau d'images partagé** : chacun montre une case, une couverture de sa collection ou un visuel d'Explorer pendant qu'il parle. L'image s'affiche en grand pour tout le salon, avec son crédit.
- **Après le direct** : une planche de synthèse (sujet, intervenants, images montrées) peut être publiée dans le fil.
- **Points de rang** : un débat animé rapporte 40 XP (barème de `domains/community/ranks-core.js`).

## Briques techniques retenues

- **Audio** : WebRTC via un SFU hébergé (LiveKit Cloud ou équivalent). Le pair-à-pair ne tient pas au-delà de 4 ou 5 personnes.
  - Jetons d'accès émis par le backend Panel, jamais de clé dans le client.
- **Signalisation et état du salon** (main levée, intervenants, image affichée) : canal temps réel du backend de comptes (Supabase Realtime prévu en phase 1).
- **Images** : références déjà présentes dans Panel (couvertures de la collection, visuels d'Explorer avec leur source) et, depuis D-79, pages choisies dans la galerie du téléphone.
  - Aujourd'hui, ces pages restent sur l'appareil (répétition seule).
  - Dans le salon à plusieurs, une page montrée serait transmise aux autres participants : c'est une diffusion. Proposition (DR-13, à trancher avant l'ouverture) : affichage éphémère pendant le direct seulement, une page à la fois, par l'intervenant qui a la parole ; aucune copie conservée par le serveur, ni dans une rediffusion, ni dans une planche ; signalement et retrait immédiat par l'animateur ; avis juridique sur le droit de citation avant l'ouverture.
- **Modération** : signalement, exclusion du salon, mise en sourdine par l'animateur, règles affichées à l'entrée.
  - Les débats ne sont pas enregistrés par défaut.
  - Le consentement est explicite avant toute prise de parole.

## Préalables (décisions de l'utilisateur)

1. Créer le projet de comptes (phase 1). Bloquant.
2. Choisir et ouvrir un compte chez le fournisseur audio (coût selon l'usage). Aucun compte n'est créé sans l'utilisateur.
3. Valider les règles de modération et l'âge minimum.
