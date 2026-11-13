# Débats en direct : cahier des charges (D-61)

Statut : **annoncé dans l'application, non construit.** Le direct demande des comptes en ligne et un serveur audio : il arrive après la phase 1 (service de comptes). Aucun salon n'est simulé en attendant.

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
- **Images** : seulement des références déjà présentes dans Panel (couvertures de la collection, visuels d'Explorer avec leur source). Les envois d'images libres sont exclus de la première version.
- **Modération** : signalement, exclusion du salon, mise en sourdine par l'animateur, règles affichées à l'entrée.
  - Les débats ne sont pas enregistrés par défaut.
  - Le consentement est explicite avant toute prise de parole.

## Préalables (décisions de l'utilisateur)

1. Créer le projet de comptes (phase 1). Bloquant.
2. Choisir et ouvrir un compte chez le fournisseur audio (coût selon l'usage). Aucun compte n'est créé sans l'utilisateur.
3. Valider les règles de modération et l'âge minimum.
