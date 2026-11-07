# Phase 5 : Panel contre League of Comic Geeks

But : mesurer, sur de vrais comics, si le scanner de Panel identifie aussi bien et aussi vite que l'app LoCG, et s'il ne se trompe jamais en silence.

## Ce qu'il faut

- Les 30 comics de `fiche-comparaison.csv`. Ils ont été pris dans ta collection (export LoCG) et couvrent 10 standards, 8 variantes (ratio, foil, virgin, réimpression), 3 Annuals ou Specials, 3 recueils, 3 numéros anciens (dont un *newsstand* de 1986) et 3 conditions difficiles. Si tu n'en retrouves pas un, remplace-le par un comic de la même catégorie.
- L'app League of Comic Geeks sur ton téléphone.
- Panel ouvert avec une caméra (voir « Accès à la caméra » plus bas).
- Un chronomètre (celui du téléphone suffit) pour LoCG. Panel mesure son temps tout seul.

## Avant de commencer

1. Dans Panel, ouvre ⚙️ Paramètres :
   - « Sauvegarder maintenant » ;
   - « Journal des scans » → **Vider**.
2. Dans la fiche, remplis la colonne « Code-barres lu sur le comic » : les 12 chiffres sous les barres, plus les 5 petits chiffres à droite. Ce sera la référence.
3. Range les comics dans l'ordre de la fiche.

> Panel ne connaît pas encore le code de chaque série : la **première fois** qu'il voit une série, il demande son titre (une seule fois). LoCG, lui, a une base de codes complète. On mesure donc deux passages :
> - **Passage 1** : les 30 comics, Panel « à froid ».
> - **Passage 2** : 10 comics de séries déjà vues, en mode continu.

## Passage 1 : un comic à la fois (30 comics)

Pour chaque ligne, suis l'ordre de la colonne « Ordre » : on alterne pour ne pas avantager une app.

**Côté Panel** (mode continu désactivé) :

1. Ouvre le scanner, vise le code.
2. Dans la fiche qui s'ouvre, corrige ce qui est faux : titre, variante, couverture.
3. Clique sur « Enregistrer ».

**Côté LoCG** :

1. Lance le chrono au moment où tu vises.
2. Arrête-le quand l'app affiche le comic.
3. Ajoute-le, puis note le temps et le nombre de touches.

**Comment remplir les colonnes (OK = oui / non)** :

| Colonne | « oui » si… |
|---|---|
| Série OK | le bon titre **et** le bon volume (année) est proposé, sans correction |
| Numéro OK | le bon numéro est proposé |
| Édition OK | la bonne variante ou le bon tirage est proposé (« Cover A probable » compte comme oui seulement si c'est bien la Cover A) |
| Couverture OK | l'image présélectionnée est bien celle de ton exemplaire. Une image « approchée » (même dessin, sans le foil) compte comme oui, avec une remarque |
| Ajout erroné | **le plus important** : l'app a présenté une mauvaise édition comme certaine, sans rien signaler |
| Touches | touches nécessaires pour arriver à « ajouté » |

Pour Panel, temps et touches sont dans le journal : tu peux laisser ces colonnes vides.

## Passage 2 : mode continu (10 comics)

Prends 10 comics déjà scannés au passage 1, dont au moins 3 variantes.

- **Panel** : active « ⚡ Mode continu » et enchaîne les 10. Note combien sont ajoutés directement, combien partent dans « À confirmer », et s'il y a une erreur.
- **LoCG** : fais la même série avec son mode d'ajout rapide.

## Après

1. Dans Panel : ⚙️ Paramètres → Journal des scans → **Exporter (CSV)**.
2. Envoie-moi ce CSV et `fiche-comparaison.csv` remplie. Je calculerai les résultats et les écarts avec LoCG, puis je proposerai les corrections.

## Critères de réussite proposés

| Critère | Objectif |
|---|---|
| Ajouts erronés de Panel | **0** (un comic incertain doit toujours être signalé) |
| Série et numéro corrects | ≥ 95 % |
| Édition exacte (avec le relais GCD) | ≥ 90 % des comics à supplément |
| Couverture correcte | ≥ 85 % |
| Temps médian de Panel | ≤ temps médian de LoCG + 2 s (au passage 2) |
| Codes lus dans les 3 conditions difficiles | au moins 2 sur 3, sinon le conseil à l'écran doit apparaître |

## Accès à la caméra (à choisir)

Le navigateur n'autorise la caméra qu'en HTTPS, ou sur `localhost`.

- **A. PC avec webcam** : `node serve.js` puis http://localhost:8080. Fonctionne déjà, relais GCD compris. En revanche, une webcam fait souvent mal la mise au point de près : ce n'est pas représentatif d'un téléphone.
- **B. Téléphone, Panel hébergé en HTTPS** (Netlify par exemple). Il faut d'abord retirer la clé Comic Vine intégrée, et le relais GCD ne suit pas sans hébergement dédié : l'identification exacte des variantes serait dégradée pendant le test.
- **C. Téléphone sur le Wi-Fi de ton PC, en HTTPS local** (recommandé). Il faut ajouter un mode HTTPS à `serve.js`, avec un certificat généré sur ton PC. Le téléphone affiche une alerte de sécurité la première fois. Tout fonctionne, relais GCD compris, et rien n'est publié.
