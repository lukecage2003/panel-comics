'use strict';
// J'aime personnalisé (D-96, D-98) : chacun choisit la forme de son « J'aime ».
//  - 12 formes classiques (glyphes de l'interface) ;
//  - plus de 150 badges dessinés par Panel : têtes d'archétypes de héros et artefacts, générés ici en SVG.
// Règles de droit, vérifiées par les tests :
//  - chaque dessin est une composition originale de formes simples (cagoule, casque, cheveux, regard, accessoire) ;
//    aucun logo, aucun emblème d'éditeur, aucun motif distinctif d'un costume déposé (pas de toile, pas de symbole de poitrine
//    d'un personnage) ; les marques de poitrine sont des formes génériques (étoile, éclair, losange, anneau, lune…) ;
//  - chaque nom affiché est un nom original en français, jamais le nom d'un personnage ou d'une marque ;
//  - les « tags » ne servent qu'à retrouver un dessin à partir de ce que l'utilisateur tape (son personnage favori) :
//    ils ne sont jamais affichés et ne revendiquent aucune affiliation.
// Module pur : aucune dépendance, aucun réseau, aucun stockage. Les SVG sont mis en cache en mémoire.

// ---------------------------------------------------------------- Classiques (symboles déjà présents dans l'interface)
const ICONS = Object.freeze([
  { key: 'heart', label: 'Cœur', hint: 'Le classique' },
  { key: 'claws', label: 'Griffes', hint: 'Pour les félins et les rois' },
  { key: 'bolt', label: 'Éclair', hint: 'Pour les bolides et les dieux du tonnerre' },
  { key: 'web', label: 'Toile', hint: 'Pour les tisseurs' },
  { key: 'hammer', label: 'Marteau', hint: 'Pour les dignes' },
  { key: 'wings', label: 'Ailes de nuit', hint: 'Pour les justiciers de la nuit' },
  { key: 'flame', label: 'Flamme', hint: 'Pour ceux qui s\'embrasent' },
  { key: 'cosmic', label: 'Cosmique', hint: 'Pour les voyageurs des étoiles' },
  { key: 'ring', label: 'Anneau', hint: 'Pour les porteurs de lumière' },
  { key: 'mask', label: 'Masque', hint: 'Pour les identités secrètes' },
  { key: 'shield', label: 'Bouclier', hint: 'Pour les protecteurs' },
  { key: 'skull', label: 'Crâne', hint: 'Pour les antihéros' }
]);

const CATEGORIES = Object.freeze([
  { key: 'nuit', label: 'Justiciers de la nuit' },
  { key: 'puissants', label: 'Les puissants' },
  { key: 'cosmos', label: 'Cosmiques' },
  { key: 'magie', label: 'Magie et mystère' },
  { key: 'legendes', label: 'Dieux et légendes' },
  { key: 'machines', label: 'Armures et machines' },
  { key: 'dons', label: 'Pouvoirs nés' },
  { key: 'indes', label: 'Héros indés' },
  { key: 'anti', label: 'Antihéros' },
  { key: 'vilains', label: 'Grands méchants' },
  { key: 'betes', label: 'Bêtes et créatures' },
  { key: 'artefacts', label: 'Artefacts' },
  { key: 'classiques', label: 'Classiques' }
]);

// ---------------------------------------------------------------- Têtes : clé|nom|catégorie|dessin|couleurs|tags
// Dessin : H coiffe (cowl, full, helmet, hood, robot, dome, bubble, nemes + variantes), R cheveux, E regard, M bouche,
//          K marques (front, ou c- pour la poitrine ; :couleur), X détails, A accessoires.
// Couleurs : fond, costume, accent, yeux, peau, cheveux[, masque]. Jetons : s1-s6 (teintes de peau), w, k, g, si, bo.
const HEADS = `
chevalier-nuit|Justicier de minuit|nuit|H=cowl.pointed E=slit M=stern K=c-moon:f5c518|1e293b,2f3542,f5c518,w,s2,k|batman bruce wayne dark knight chauve souris
gardienne-nuit|Gardienne de la nuit|nuit|H=cowl.pointed R=long E=lens M=smile K=c-moon:facc15|0f172a,1e293b,facc15,w,s1,dc2626|batgirl barbara gordon
aile-minuit|Acrobate de minuit|nuit|R=short E=domino M=smile K=c-chev:3b82f6|0f172a,111827,3b82f6,w,s3,k|nightwing dick grayson
rouge-gorge|Jeune acolyte|nuit|R=short E=domino M=smile X=cape K=c-dot:facc15|7f1d1d,dc2626,facc15,w,s1,k|robin damian wayne tim drake jason todd
feline-toits|Féline des toits|nuit|H=cowl.cat E=goggles M=smile|312e81,111827,6b7280,7dd3fc,s2,k|catwoman selina kyle chat
chasseuse|Chasseuse à l'arbalète|nuit|R=long E=domino M=stern K=c-x:f8fafc|3b0764,6d28d9,f8fafc,w,s1,k,6d28d9|huntress helena bertinelli
diable-aveugle|Diable aveugle|nuit|H=cowl.horns E=lens M=stern|450a0a,b91c1c,7f1d1d,991b1b,s2,k|daredevil matt murdock diable
chevalier-lune|Gardien lunaire|nuit|H=full A=hood E=glow M=none K=moon:94a3b8|1e1b4b,f1f5f9,e2e8f0,c7d2fe,s2,k|moon knight marc spector lune
archer-emeraude|Archer de la forêt|nuit|A=hood R=short E=domino M=smile X=goatee|14532d,16a34a,166534,w,s2,d97706,15803d|green arrow oliver queen fleche
le-juge|Le Juge|nuit|R=short E=angry M=frown X=stubble,scar|111827,1f2937,ef4444,k,s2,1c1917|punisher frank castle
ombre-ninja|Ombre ninja|nuit|H=full A=band E=ninja M=none|0c0a09,1c1917,dc2626,k,s3,k|ninja la main hand
sans-visage|Le Sans-Visage|nuit|H=full A=hat E=none M=none|1e3a8a,f2d7b8,2563eb,k,s1,k|question vic sage
detective|Détective de minuit|nuit|R=short A=hat E=human M=line X=stubble|292524,78350f,57534e,k,s2,292524|detective noir enqueteur
fileuse-fantome|Fileuse fantôme|nuit|H=full A=hood E=lens M=none|1f2937,f8fafc,ec4899,f8fafc,s1,k|spider gwen ghost spider gwen stacy
tisseur-ecarlate|Tisseur écarlate|nuit|H=full.seam E=lens M=none|1e3a8a,dc2626,b91c1c,w,s1,k|spider man spiderman peter parker araignee homme araignee
tisseur-brooklyn|Tisseur de Brooklyn|nuit|H=full.seam E=lens M=none|b91c1c,111827,dc2626,w,s4,k|miles morales spider man
veuve-rousse|Espionne rousse|nuit|R=long E=human M=line|111827,0f172a,dc2626,k,s1,b91c1c|black widow natasha romanoff veuve noire yelena
archer-pourpre|Archer pourpre|nuit|R=short E=human M=smile X=paint|3b0764,6b21a8,a855f7,k,s1,a16207|hawkeye clint barton kate bishop
lame-silencieuse|Lame silencieuse|nuit|R=long A=band E=human M=stern|450a0a,991b1b,dc2626,k,s2,k|elektra natchios
lutteur-masque|Lutteur masqué|nuit|H=full.split E=lens M=line K=star:facc15|9d174d,db2777,7c3aed,w,s3,k|luchador catch masque
fils-etoiles|Fils des étoiles|puissants|R=curl E=human M=smile X=cape K=c-gem:dc2626|1d4ed8,2563eb,dc2626,k,s1,k|superman clark kent kal el
cousine-etoiles|Cousine des étoiles|puissants|R=long E=human M=smile X=cape K=c-gem:dc2626|1e40af,2563eb,dc2626,k,s1,fcd34d|supergirl kara zor el
princesse-amazone|Princesse amazone|puissants|R=long A=tiara E=human M=smile|7f1d1d,b91c1c,f5c518,k,s2,k|wonder woman diana prince amazone
capitaine-etoile|Capitaine étoilé|puissants|H=cowl E=human M=stern K=star:f8fafc,c-star:f8fafc|b91c1c,1d4ed8,f8fafc,k,s1,k|captain america steve rogers sam wilson
colosse-emeraude|Colosse émeraude|puissants|R=wild E=angry M=frown|3b0764,7c3aed,a855f7,k,65a30d,1c1917|hulk bruce banner
colosse-ecarlate|Colosse écarlate|puissants|R=short E=angry M=fangs|450a0a,111827,ef4444,k,dc2626,1c1917|red hulk rulk ross
geante-emeraude|Géante émeraude|puissants|R=long E=human M=smile|581c87,f8fafc,7c3aed,k,4ade80,14532d|she hulk jennifer walters miss hulk
capitaine-cometes|Capitaine des comètes|puissants|R=long E=human M=smile K=c-star:facc15|1e3a8a,b91c1c,1d4ed8,k,s1,fde68a|captain marvel carol danvers
bolide-ecarlate|Coureur foudre|puissants|H=cowl.wings E=human M=smile K=bolt:facc15|7f1d1d,dc2626,facc15,k,s1,k|flash barry allen wally west
champion-tonnerre|Champion du tonnerre|puissants|R=short E=human M=smile X=cape K=c-bolt:facc15|7f1d1d,dc2626,f8fafc,k,s1,k|shazam billy batson captain marvel
sentinelle-doree|Sentinelle dorée|puissants|R=short E=human M=smile X=cape K=c-sun:1d4ed8|1e3a8a,f5c518,1d4ed8,k,s1,fde68a|sentry robert reynolds
colosse-acier|Géant de métal|puissants|R=short E=human M=stern X=rock|7f1d1d,dc2626,facc15,k,cbd5e1,1c1917|colossus piotr rasputin
demi-dieu|Demi-dieu|puissants|R=curl A=laurel E=human M=smile X=beard|78350f,b45309,f5c518,k,s2,451a03|hercule hercules heracles
reine-volante|Reine volante|puissants|R=bob E=human M=smile X=cape K=c-star:f8fafc|0c4a6e,0284c7,f8fafc,k,s4,k|heroine volante
gardien-montagnes|Gardien des montagnes|puissants|R=bald E=human M=stern X=beard|365314,4d7c0f,a3e635,k,s5,e7e5e4|gardien geant
heraut-chrome|Héraut chromé|cosmos|R=bald E=glow M=line|1e1b4b,cbd5e1,e2e8f0,f8fafc,e2e8f0,k|silver surfer norrin radd surfeur argent
titan-pourpre|Titan pourpre|cosmos|H=helmet.open E=human M=smile X=chinlines|312e81,f5c518,1d4ed8,k,7c3aed,k|thanos titan fou
chasseur-etoiles|Chasseur d'étoiles|cosmos|H=helmet E=glow M=none|1f2937,7f1d1d,9ca3af,ef4444,s1,k|star lord peter quill
arbre-gardien|Arbre-gardien|cosmos|A=leaves E=human M=smile X=bark|14532d,78350f,22c55e,k,92400e,k|groot arbre
guerriere-emeraude|Guerrière émeraude|cosmos|R=long E=human M=stern|14532d,1f2937,f43f5e,k,22c55e,1c1917|gamora
destructeur|Colosse tatoué|cosmos|R=bald E=angry M=stern X=tattoo|450a0a,7f1d1d,dc2626,k,64748b,k|drax destructeur
centurion-nova|Centurion stellaire|cosmos|H=helmet.fins3 E=visor M=none|1e3a8a,111827,f5c518,fde68a,s1,k|nova richard rider sam alexander
porteur-emeraude|Porteur d'émeraude|cosmos|R=short E=domino M=smile K=c-ring:f8fafc|052e16,15803d,111827,w,s2,k,15803d|green lantern hal jordan john stewart lanterne verte
princesse-soleil|Princesse du soleil|cosmos|R=long E=glow M=smile|7c2d12,7c3aed,a855f7,4ade80,f59e0b,dc2626|starfire koriand r
astronaute|Astronaute des confins|cosmos|H=bubble R=short E=human M=smile|0f172a,f8fafc,f97316,k,s3,k|astronaute espace
visiteur-gris|Visiteur gris|cosmos|H=dome E=alien M=none|052e16,4b5563,a3e635,k,a1a1aa,k|alien extraterrestre gris
chasseur-mars|Chasseur de Mars|cosmos|R=bald E=glow M=stern X=cape,brow K=c-x:dc2626|1e3a8a,1d4ed8,dc2626,ef4444,16a34a,k|martian manhunter j onn jonzz
devoreur-mondes|Géant des étoiles|cosmos|H=helmet.open.prongs E=glow M=stern|1e1b4b,7c3aed,2563eb,f8fafc,9ca3af,k|galactus
comete-blanche|Comète blanche|cosmos|R=long E=glow M=smile K=star:f8fafc|0c0a09,6366f1,f8fafc,e0f2fe,s4,f8fafc|comete etoile
gardienne-galaxie|Gardienne de la galaxie|cosmos|R=bob E=visor M=smile|134e4a,0f766e,5eead4,5eead4,s5,k|gardienne galaxie
pilote-etoile|Pilote d'étoile|cosmos|R=short A=goggleup E=human M=smile X=freckles|7c2d12,ea580c,1e3a8a,93c5fd,s1,b45309|pilote
homme-atomique|Être atomique|cosmos|R=bald E=glow M=line K=atom:bfdbfe|0c4a6e,60a5fa,93c5fd,f8fafc,60a5fa,k|doctor manhattan docteur manhattan watchmen
faucon-or|Faucon d'or|legendes|H=cowl.wings E=human M=stern X=wingsback|713f12,ca8a04,e5e7eb,k,s2,k|hawkman hawkgirl faucon
sorcier-supreme|Maître des arcanes|magie|R=greytemples E=human M=stern X=goatee,mustache,collar K=c-eye:f5c518|1e3a8a,1d4ed8,dc2626,22c55e,s1,1c1917|doctor strange docteur strange stephen strange
sorciere-ecarlate|Mage du chaos|magie|R=long A=crownspikes E=glow M=line|450a0a,b91c1c,dc2626,f87171,s1,7f1d1d|scarlet witch wanda maximoff
magicienne-chapeau|Magicienne au chapeau|magie|R=long A=tophat E=human M=smile|1e1b4b,111827,111827,k,s1,k|zatanna magicienne
corbeau|Corbeau|magie|A=hood E=human M=line K=gem:dc2626|1e1b4b,312e81,312e81,k,cbd5e1,k|raven rachel roth teen titans
motard-ardent|Motard ardent|magie|A=flame E=void M=teeth X=skull|1c1917,1c1917,f97316,fbbf24,bo,k|ghost rider johnny blaze robbie reyes
demon-coeur|Démon au grand cœur|magie|R=bun A=stumps E=human M=smile X=goatee|292524,7c2d12,f5c518,k,dc2626,k|hellboy
exorciste|Exorciste en trench|magie|R=wild E=human M=line X=stubble|292524,a16207,dc2626,k,s1,fcd34d|constantine john constantine hellblazer
enchanteresse|Charmeuse dorée|magie|R=long A=crown E=human M=smile|14532d,16a34a,f5c518,k,s1,fcd34d|enchantress amora
prince-vampire|Prince vampire|magie|R=slick E=glow M=fangs X=collar|450a0a,111827,b91c1c,ef4444,e2e8f0,k|vampire dracula morbius
momie|Momie éveillée|magie|H=full E=glow M=none X=wraps|422006,e7e5e4,a8a29e,22d3ee,s1,k|momie mummy
chamane|Chamane des tempêtes|magie|R=braids A=band E=closed M=smile X=paint|0f766e,115e59,f59e0b,k,s4,k|chamane
poing-jade|Poing de jade|magie|R=short E=domino M=stern|14532d,15803d,facc15,w,s1,facc15,166534|iron fist danny rand
spectre-vengeur|Spectre vengeur|magie|A=hood E=void M=line|052e16,15803d,15803d,f8fafc,f8fafc,k|spectre jim corrigan
seigneur-songes|Seigneur des songes|magie|R=wild E=void M=line|0c0a09,111827,f8fafc,f8fafc,f1f5f9,k|sandman morpheus dream reve
sorciere-foret|Sorcière de la forêt|magie|R=long A=witchhat E=human M=smile|14532d,166534,1c1917,k,s3,7c2d12|sorciere foret
mage-runes|Mage des runes|magie|A=hood E=glow M=none X=beard|1e1b4b,4338ca,312e81,a5b4fc,s2,e5e7eb|mage merlin sorcier
necromancienne|Nécromancienne|magie|R=bob E=glow M=line X=paint|0c0a09,3f3f46,a855f7,c084fc,e2e8f0,k|necromancienne
dieu-tonnerre|Dieu du tonnerre|legendes|H=helmet.open.wings R=long E=human M=stern X=beard|1e3a8a,9ca3af,dc2626,k,s1,fcd34d|thor odinson tonnerre
prince-cornu|Prince cornu|legendes|H=helmet.open.horns R=long E=human M=smile|14532d,f5c518,f5c518,k,s1,k|loki laufeyson
deesse-mort|Déesse de la mort|legendes|A=antlers R=long E=glow M=line|052e16,111827,1f2937,4ade80,e2e8f0,k|hela mort
pere-borgne|Père borgne|legendes|H=helmet.open.wings R=long E=patch M=stern X=beard|422006,ca8a04,e5e7eb,k,s1,f1f5f9|odin borgne
valkyrie|Valkyrie|legendes|H=helmet.open.wings R=long E=human M=stern X=paint|1e3a8a,cbd5e1,e5e7eb,k,s5,fde68a|valkyrie brunnhilde
roi-marees|Roi des marées|legendes|R=long E=human M=smile X=beard|0e7490,f97316,16a34a,k,s1,f59e0b|aquaman arthur curry atlantis
reine-marees|Reine des marées|legendes|R=long A=tiara E=human M=smile|064e3b,16a34a,f5c518,k,s1,dc2626|mera atlantis
prince-abysses|Prince des abysses|legendes|R=slick E=angry M=stern X=elfears|0c4a6e,15803d,22c55e,k,s1,k|namor sub mariner
pharaon-foudroye|Pharaon foudroyé|legendes|R=slick E=angry M=stern X=cape K=c-bolt:facc15|1c1917,111827,facc15,k,s4,k|black adam teth adam
dieu-soleil|Dieu-soleil|legendes|H=nemes E=human M=line X=paint K=c-sun:f5c518|1e3a8a,f5c518,1d4ed8,k,s4,k|pharaon egypte soleil
gorgone|Gorgone|legendes|R=snakes E=glow M=smile|14532d,166534,4ade80,facc15,a7f3d0,16a34a|meduse gorgone
samourai|Samouraï|legendes|H=helmet.open.crescent E=human M=stern|1c1917,7f1d1d,f5c518,k,s2,k|samourai japon
spartiate|Spartiate|legendes|H=helmet.open.crestbig E=angry M=stern X=beard|7c2d12,b45309,dc2626,k,s2,1c1917|spartiate grece
chevalier-graal|Chevalier du Graal|legendes|H=helmet E=slit M=none K=c-x:dc2626|1e3a8a,cbd5e1,94a3b8,0f172a,s1,k|chevalier croisade
viking|Viking|legendes|H=helmet.open A=hornsbull R=long E=human M=stern X=beard|0c4a6e,94a3b8,e7e5e4,k,s1,c2410c|viking nord
ange-gardien|Ange gardien|legendes|R=long A=halo E=human M=smile X=wingsback|0c4a6e,f8fafc,f8fafc,k,s2,fde68a|ange angel
reine-nil|Reine du Nil|legendes|R=bob A=crown E=human M=smile X=paint|1e3a8a,f5c518,1d4ed8,k,s4,k|cleopatre reine egypte
roi-felin|Roi félin|legendes|H=full.cat E=slit M=none X=necklace|3b0764,1e1b2e,c4b5fd,f8fafc,s5,k|black panther t challa wakanda panthere noire
princesse-genie|Princesse génie|machines|R=braids A=goggleup E=human M=smile|3b0764,111827,a855f7,a5b4fc,s5,k|shuri wakanda
armure-ecarlate|Armure écarlate|machines|H=helmet E=slit M=none K=c-reactor:7dd3fc|451a03,b91c1c,f5c518,e0f2fe,s1,k|iron man tony stark armure
machine-guerre|Armure lourde|machines|H=helmet E=slit M=none K=c-reactor:7dd3fc|1f2937,4b5563,9ca3af,e0f2fe,s1,k|war machine james rhodes
armure-glace|Armure de glace|machines|H=helmet.crest E=visor M=none|0c4a6e,e0f2fe,38bdf8,22d3ee,s1,k|armure glace
demi-machine|Demi-machine|machines|R=bald E=human M=stern X=halfmetal|1f2937,94a3b8,ef4444,k,s5,k|cyborg victor stone
synthezoide|Androïde de rubis|machines|R=bald E=human M=line X=collar K=gem:f5c518|14532d,15803d,f5c518,k,dc2626,k|vision synthezoide
robot-ami|Robot ami|machines|H=robot A=antennae E=glow M=smile|0c4a6e,60a5fa,f5c518,e0f2fe,s1,k|robot
homme-fourmi|Pilote minuscule|machines|H=helmet A=antennae E=goggles M=none|7f1d1d,dc2626,1f2937,60a5fa,s1,k|ant man scott lang hank pym fourmi
guepe|Reine bourdon|machines|R=bob A=antennae E=domino M=smile X=wingsback|1c1917,facc15,fef9c3,w,s1,k,1c1917|wasp janet van dyne guepe
pilote-meca|Pilote de méca|machines|H=helmet.fins3 E=visor M=none|7f1d1d,f8fafc,dc2626,38bdf8,s1,k|mecha robot geant
pirate-reseau|Pirate du réseau|machines|A=hood R=short E=visor M=smile|0f172a,1f2937,1f2937,22c55e,s3,k|hacker pirate informatique
cyber-ninja|Cyber-ninja|machines|H=full.seam A=band E=visor M=none|0f172a,1e293b,ef4444,ef4444,s1,k|cyber ninja
androide|Androïde argenté|machines|H=full.seam E=glow M=line|1e1b4b,e2e8f0,94a3b8,60a5fa,s1,k|androide
le-griffu|Le Griffu|dons|H=cowl.fins E=slit M=grin X=stubble|1e3a8a,facc15,1d4ed8,w,s2,k|wolverine logan serval
dame-orages|Dame des orages|dons|R=long E=glow M=line|1e1b4b,111827,e5e7eb,f8fafc,s5,f1f5f9|storm ororo munroe tornade
bete-bleue|Bête bleue|dons|R=wild E=human M=fangs|1e3a8a,111827,1d4ed8,k,3b82f6,1e3a8a|beast hank mccoy le fauve
diablotin-bleu|Diablotin bleu|dons|R=short E=glow M=smile X=elfears|450a0a,dc2626,111827,facc15,1e40af,1e1b4b|nightcrawler kurt wagner diablo
professeur|Le Professeur|dons|R=bald E=human M=smile|1e3a8a,1f2937,facc15,k,s1,k|professor x professeur x charles xavier
phenix|Flamme renaissante|dons|R=long E=glow M=line K=c-sun:facc15|7c2d12,dc2626,facc15,fde68a,s1,ea580c|phoenix phenix jean grey
joueur-cajun|Joueur cajun|dons|H=cowl R=long E=glow M=smile X=stubble|1e1b4b,c026d3,78350f,ef4444,s1,78350f|gambit remy lebeau
voleuse-ames|Voleuse d'âmes|dons|R=streak E=human M=smile|14532d,16a34a,facc15,k,s1,78350f|rogue malicia anna marie
homme-glace|Homme de glace|dons|R=short E=glow M=smile|0c4a6e,bae6fd,38bdf8,f8fafc,bfdbfe,e0f2fe|iceman bobby drake iceberg
torche-vivante|Torche vivante|dons|A=flame E=glow M=none|7c2d12,ea580c,facc15,fef08a,f97316,k|human torch johnny storm torche humaine
femme-invisible|Dame transparente|dons|R=long E=human M=smile X=ghost|1e3a8a,1d4ed8,f8fafc,k,s1,fcd34d|invisible woman sue storm
homme-elastique|Savant extensible|dons|R=greytemples E=human M=smile|1e3a8a,1d4ed8,f8fafc,k,s1,57534e|mr fantastic reed richards
colosse-roche|Colosse de roche|dons|R=bald E=human M=stern X=rock|1e3a8a,1d4ed8,f8fafc,k,ea580c,k|thing la chose ben grimm
oeil-laser|Œil-laser|dons|R=short E=visor M=stern|1e3a8a,1d4ed8,facc15,ef4444,s1,7c2d12|cyclops cyclope scott summers
milles-visages|Aux mille visages|dons|R=short E=glow M=smile|1e1b4b,f8fafc,dc2626,facc15,2563eb,dc2626|mystique raven darkholme
jeune-invulnerable|Jeune invulnérable|indes|R=short E=goggles M=smile|1d4ed8,facc15,1e40af,172554,s1,k|invincible mark grayson
patriarche|Patriarche des étoiles|indes|R=short E=human M=stern X=mustache,cape|7f1d1d,f8fafc,dc2626,k,s1,e5e7eb|omni man nolan grayson invincible
eclat-rose|Éclat rose|indes|R=long E=domino M=smile|831843,ec4899,f9a8d4,w,s1,dc2626,ec4899|atom eve samantha wilkins invincible
bete-bataille|Lion guerrier|indes|R=wild E=angry M=fangs X=snout|7c2d12,1f2937,fde68a,k,d97706,92400e|battle beast invincible lion
oeil-etoiles|Œil des étoiles|indes|R=bald E=cyclops M=smile|1e3a8a,f8fafc,1d4ed8,22c55e,60a5fa,k|allen alien invincible
robot-gardien|Robot gardien|indes|H=robot E=cyclops M=none|1f2937,64748b,94a3b8,ef4444,s1,k|robot rex splode invincible
revenant|Revenant|indes|H=full E=glow M=none X=spikes|7f1d1d,111827,f8fafc,4ade80,s1,k|spawn al simmons
dragon-sauvage|Dragon à crête|indes|A=fin R=bald E=angry M=stern|14532d,111827,16a34a,k,4ade80,k|savage dragon
soldate-ailee|Soldate ailée|indes|R=long E=human M=smile X=wingsback|134e4a,0f766e,a7f3d0,k,s3,ea580c|saga alana
mage-cornu|Mage cornu|indes|R=short A=hornsbull E=human M=smile|1e1b4b,4338ca,e7e5e4,k,s2,1c1917|saga marko
visage-encre|Visage d'encre|anti|H=full A=hat E=none M=none X=blots|1c1917,f8fafc,7c2d12,k,s1,k|rorschach watchmen
mercenaire-bavard|Mercenaire bavard|anti|H=full E=patches M=none|1c1917,b91c1c,111827,w,s1,k|deadpool wade wilson
exterminateur|Mercenaire bicolore|anti|H=full.split E=slit M=none|1c1917,f97316,111827,w,s1,k|deathstroke slade wilson
masque-mort|Masque de mort|anti|H=full E=void M=teeth X=skull|0c0a09,f1f5f9,1c1917,dc2626,s1,k|crane tete de mort skull
chasseur-primes|Chasseur de primes|anti|H=helmet E=visor M=none|1c1917,4d7c0f,b45309,0f172a,s1,k|chasseur de primes mercenaire
pistolera|Pistolera|anti|R=long A=hat E=human M=smile|7c2d12,92400e,78350f,k,s3,k|cowboy western pistolera
pirate-borgne|Pirate borgne|anti|R=wild A=band E=patch M=grin X=beard|0c4a6e,7f1d1d,dc2626,k,s2,1c1917|pirate
mercenaire-cyber|Mercenaire du futur|anti|R=short E=human M=stern X=halfmetal,scar|1c1917,57534e,ef4444,k,s2,f8fafc|cable nathan summers
tireuse-elite|Tireuse d'élite|anti|R=bob E=goggles M=stern|292524,57534e,d97706,22d3ee,s3,k|tireuse d elite
chasseur-vampires|Chasseur de vampires|anti|R=short E=visor M=stern X=goatee|1c1917,111827,dc2626,0f172a,s5,k|blade eric brooks
rebelle-cuir|Rebelle en cuir|anti|R=streak E=human M=smile|1c1917,111827,dc2626,k,s1,k|rebelle
symbiote|Symbiote|anti|H=full E=jagged M=fangs|0f172a,0b0b12,334155,w,s1,k|venom eddie brock symbiote
carnage-ecarlate|Symbiote écarlate|vilains|H=full E=jagged M=fangs|450a0a,b91c1c,7f1d1d,w,s1,k|carnage cletus kasady
farceur|Le Farceur|vilains|R=short E=human M=grin|3b0764,6b21a8,16a34a,k,f8fafc,16a34a|joker
arlequine|Arlequine|vilains|R=pigtails E=domino M=grin X=splithair|1c1917,dc2626,1d4ed8,w,f8fafc,f8fafc,111827|harley quinn
epouvantail|Homme de paille|vilains|H=full A=witchhat E=void M=stitch X=stitches|422006,d6a565,57534e,f97316,s1,k|scarecrow jonathan crane
double-visage|Visage brisé|vilains|R=short E=human M=line X=halfscar|1c1917,1f2937,7c3aed,k,s1,1c1917|two face double face harvey dent
empoisonneuse|Empoisonneuse|vilains|R=long A=leaves E=human M=smile|14532d,16a34a,22c55e,k,bbf7d0,dc2626|poison ivy pamela isley
genie-chauve|Génie chauve|vilains|R=bald E=human M=smile|14532d,7c3aed,16a34a,k,s1,k|lex luthor
reine-gel|Reine du gel|vilains|R=long E=glow M=line|0c4a6e,e0f2fe,7dd3fc,38bdf8,bfdbfe,f8fafc|killer frost
lutin-vert|Farfadet masqué|vilains|A=witchhat E=glow M=grin|3b0764,7c3aed,7c3aed,facc15,65a30d,k|green goblin bouffon vert norman osborn
maitre-aimant|Roi des métaux|vilains|H=helmet.open.crest E=angry M=stern X=cape|3b0764,b91c1c,7c3aed,k,s1,k|magneto erik lehnsherr
maitre-peur|Maître de la peur|vilains|R=slick E=human M=smile X=mustache|422006,facc15,111827,k,c026d3,k|sinestro
conquerant-temps|Tyran du futur|vilains|H=helmet.open.crest E=human M=stern|3b0764,16a34a,7c3aed,k,60a5fa,k|kang conquerant
intelligence-rebelle|Intelligence rebelle|vilains|H=robot E=glow M=slot|1c1917,9ca3af,6b7280,ef4444,s1,k|ultron
tete-pensante|Tête pensante|vilains|H=dome A=band E=angry M=grin|365314,4d7c0f,facc15,k,fde68a,k|modok
monarque-fer|Monarque de fer|vilains|H=full A=hood E=slit M=grill|14532d,9ca3af,15803d,0f172a,s1,k|doctor doom fatalis victor von doom
reine-noire|Reine noire|vilains|R=long A=crown E=glow M=smile|0c0a09,111827,a855f7,a855f7,e2e8f0,k|reine noire
sorcier-noir|Sorcier noir|vilains|A=hood E=glow M=grin|1c1917,3f3f46,27272a,ef4444,a1a1aa,k|sorcier noir
gorille-telepathe|Gorille télépathe|betes|R=wild E=angry M=stern X=snout|14532d,111827,a8a29e,k,3f3f46,1c1917|gorilla grodd gorille
roi-requin|Requin des abysses|betes|A=fin E=void M=fangs|0c4a6e,1e3a8a,e2e8f0,k,64748b,k|king shark requin
croco-egouts|Crocodile des égouts|betes|R=bald E=glow M=fangs X=scales|1c1917,4d7c0f,a3e635,facc15,4d7c0f,k|killer croc crocodile
raton-mecano|Raton mécanicien|betes|A=earsround E=domino M=smile X=snout,whiskers|7c2d12,ea580c,e5e7eb,w,9ca3af,6b7280,374151|rocket raccoon raton
loup-garou|Loup-garou|betes|A=earswolf E=glow M=fangs X=snout|1e1b4b,57534e,d6d3d1,facc15,78716c,57534e|loup garou werewolf
minotaure|Minotaure|betes|A=hornsbull E=angry M=stern X=snout|7c2d12,78350f,d6d3d1,k,92400e,1c1917|minotaure taureau
gardien-hibou|Gardien hibou|betes|A=tufts E=goggles M=none X=beak|1e1b4b,78350f,f59e0b,facc15,a16207,a16207|hibou chouette
panda-montagnes|Panda des montagnes|betes|A=earsround E=domino M=smile X=snout|14532d,1f2937,f8fafc,w,f8fafc,1f2937,1f2937|panda
chat-etoiles|Chat des étoiles|betes|A=earscat E=glow M=smile X=snout,whiskers|1e1b4b,f97316,fed7aa,4ade80,fb923c,f97316|goose flerken chat
chien-volant|Chien volant|betes|A=earsround E=human M=smile X=snout,cape|1e3a8a,dc2626,f8fafc,k,f8fafc,f8fafc|krypto chien
fille-ecureuil|Amie des écureuils|betes|R=short A=earswolf E=human M=smile X=freckles|78350f,a16207,fde68a,k,s1,92400e|squirrel girl ecureuil doreen green
renard-minuit|Renard de minuit|betes|A=earswolf E=domino M=smile X=snout|1e1b4b,ea580c,f8fafc,w,ea580c,ea580c,1c1917|renard fox
ours-polaire|Ours polaire|betes|A=earsround E=human M=smile X=snout|0c4a6e,f1f5f9,e2e8f0,k,f8fafc,f1f5f9|ours polaire
tigre-blanc|Tigre blanc|betes|A=earscat E=glow M=fangs X=snout,stripes|1e1b4b,f8fafc,f1f5f9,38bdf8,f8fafc,f8fafc|tigre blanc white tiger
dragon-ecarlate|Dragon écarlate|betes|A=hornsbull E=glow M=fangs X=scales,snout|450a0a,b91c1c,fca5a5,facc15,dc2626,k|dragon
aigle-cimes|Aigle des cimes|betes|A=tufts E=angry M=none X=beak|1e3a8a,78350f,f8fafc,k,f8fafc,f8fafc|aigle
esprit-renard|Esprit renard|betes|A=earswolf E=closed M=smile X=paint,snout|7c2d12,ea580c,f8fafc,k,fb923c,fb923c|kitsune renard
`;

// ---------------------------------------------------------------- Artefacts : clé|nom|dessin|couleurs (fond, a, b, c)|tags
const ARTS = `
marteau-runique|Marteau runique|hammer|1e3a8a,94a3b8,cbd5e1,92400e|mjolnir marteau thor
bouclier-etoile|Bouclier étoilé|shield|7f1d1d,dc2626,f8fafc,1d4ed8|bouclier captain america
trident|Trident des mers|trident|0e7490,f5c518,fde68a,0|trident aquaman
lasso|Lasso doré|lasso|7f1d1d,f5c518,fde68a,0|lasso verite wonder woman
anneau-lumiere|Anneau de lumière|ring|052e16,cbd5e1,22c55e,0|anneau ring lanterne
gantelet|Gantelet aux six gemmes|gauntlet|312e81,f5c518,ca8a04,0|gant infini gauntlet gemmes thanos
cube-cosmique|Cube cosmique|cube|0c4a6e,38bdf8,0284c7,bae6fd|tesseract cube cosmique
amulette-oeil|Amulette de l'œil|amulet|1e1b4b,f5c518,22c55e,0|oeil agamotto amulette
lanterne|Lanterne de jade|lantern|052e16,9ca3af,4ade80,0|lanterne lantern
grimoire|Grimoire interdit|book|1c1917,7c2d12,f5c518,0|grimoire livre magie
epee-lumiere|Épée de lumière|sword|1e1b4b,f5c518,e0f2fe,7c2d12|epee excalibur sword
arc-chasseur|Arc du chasseur|bow|14532d,92400e,cbd5e1,0|arc fleche
boomerang|Boomerang|boomerang|7c2d12,f59e0b,dc2626,0|boomerang
casque-aile|Casque ailé|helmet|1e3a8a,cbd5e1,94a3b8,f8fafc|casque aile
cape-heroique|Cape héroïque|cape|1d4ed8,dc2626,991b1b,f5c518|cape
ceinture|Ceinture à outils|belt|1f2937,4b5563,f5c518,374151|ceinture utilitaire
couronne|Couronne royale|crown|3b0764,f5c518,dc2626,2563eb|couronne roi reine
orbe|Orbe tourbillon|orb|1e1b4b,7c3aed,e9d5ff,0|orbe
sceptre|Sceptre de gemme|scepter|14532d,f5c518,38bdf8,0|sceptre
baton-mage|Bâton du mage|staff|1e1b4b,7c2d12,a5b4fc,0|baton mage
potion|Potion de force|potion|14532d,22c55e,e0f2fe,92400e|potion fiole
sablier|Sablier du temps|hourglass|422006,f5c518,e0f2fe,0|sablier temps
masque-fer|Masque de fer|ironmask|14532d,9ca3af,15803d,0|masque fer
cristal-vert|Cristal vert|crystal|052e16,4ade80,16a34a,0|kryptonite cristal
coeur-reacteur|Cœur réacteur|reactor|0f172a,38bdf8,e0f2fe,0|reacteur arc
planche-cosmique|Planche cosmique|board|1e1b4b,e2e8f0,94a3b8,0|planche surf
griffes-metal|Griffes de métal|claws|1e3a8a,cbd5e1,facc15,0|griffes adamantium
loupe|Loupe du détective|magnifier|292524,92400e,e0f2fe,0|loupe detective
cle-mondes|Clé des mondes|key|3b0764,f5c518,a855f7,0|cle
numero-un|Numéro 1|comic|7f1d1d,1d4ed8,facc15,f8fafc|comics numero un
boussole|Boussole des étoiles|compass|0c4a6e,f5c518,dc2626,0|boussole
faux-ombre|Faux de l'ombre|scythe|0c0a09,cbd5e1,57534e,0|faux mort
boule-cristal|Boule de cristal|crystalball|1e1b4b,a855f7,e9d5ff,78350f|boule cristal voyance
montre-temps|Montre temporelle|watch|134e4a,f5c518,e0f2fe,0|montre temps
`;

// ---------------------------------------------------------------- Dessin
const INK = '#0d0d14';
const TOK = { s1: '#f6d3b3', s2: '#e7b08a', s3: '#c68a5e', s4: '#9c6540', s5: '#6f4428', s6: '#4a2c1a', w: '#f8fafc', k: '#14141c', g: '#f5c518', si: '#cbd5e1', bo: '#efe6d2' };
const colorOfTok = v => !v || v === '0' || v === '-' ? '' : TOK[v] || (/^[0-9a-f]{6}$/i.test(v) ? '#' + v.toLowerCase() : '');
const n1 = v => Math.round(v * 10) / 10;
const P = (d, fill, more) => '<path d="' + d + '" fill="' + (fill || 'none') + '"' + (more || '') + '/>';
const NS = ' stroke="none"';
const ST = (color, w, op) => ' stroke="' + color + '" stroke-width="' + w + '"' + (op ? ' stroke-opacity="' + op + '"' : '');
const C = (cx, cy, r, fill, more) => '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + (fill || 'none') + '"' + (more || '') + '/>';
const E = (cx, cy, rx, ry, fill, more) => '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + (fill || 'none') + '"' + (more || '') + '/>';
const MIR = s => s + '<g transform="matrix(-1 0 0 1 48 0)">' + s + '</g>';
// Trait épais encré : contour noir puis couleur (pour les objets fins)
const LINE = (d, color, w) => P(d, 'none', ST(INK, n1(w + 2.2))) + P(d, 'none', ST(color, w));

const starD = (cx, cy, r) => { let d = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; d += (i ? 'L' : 'M') + n1(cx + rr * Math.cos(a)) + ' ' + n1(cy + rr * Math.sin(a)); } return d + 'Z'; };
const boltD = (cx, cy, s) => 'M' + n1(cx + 0.35 * s) + ' ' + n1(cy - s) + 'L' + n1(cx - 0.7 * s) + ' ' + n1(cy + 0.15 * s) + 'H' + n1(cx - 0.05 * s) + 'L' + n1(cx - 0.35 * s) + ' ' + n1(cy + s) + 'L' + n1(cx + 0.7 * s) + ' ' + n1(cy - 0.15 * s) + 'H' + n1(cx + 0.05 * s) + 'Z';
const gemD = (cx, cy, s) => 'M' + n1(cx) + ' ' + n1(cy - s) + 'L' + n1(cx + 0.7 * s) + ' ' + n1(cy) + 'L' + n1(cx) + ' ' + n1(cy + s) + 'L' + n1(cx - 0.7 * s) + ' ' + n1(cy) + 'Z';
const moonD = (cx, cy, s) => 'M' + n1(cx + 0.3 * s) + ' ' + n1(cy - s) + 'A' + s + ' ' + s + ' 0 1 0 ' + n1(cx + 0.3 * s) + ' ' + n1(cy + s) + 'A' + n1(0.75 * s) + ' ' + n1(0.75 * s) + ' 0 1 1 ' + n1(cx + 0.3 * s) + ' ' + n1(cy - s) + 'Z';

// Rayons de bande dessinée derrière chaque badge (dans le disque : aucun identifiant SVG, donc aucun conflit entre badges)
const RAYS = (() => { let d = ''; for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, b = a + Math.PI / 22; d += 'M24 24L' + n1(24 + 21.5 * Math.cos(a)) + ' ' + n1(24 + 21.5 * Math.sin(a)) + 'L' + n1(24 + 21.5 * Math.cos(b)) + ' ' + n1(24 + 21.5 * Math.sin(b)) + 'Z'; } return d; })();
const badgeOpen = bg => '<svg class="ic hero" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><g stroke="' + INK + '" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round">' +
  C(24, 24, 23, bg, NS) + P(RAYS, '#fff', NS + ' fill-opacity=".07"');
const badgeClose = () => C(24, 24, 22.4, 'none', ST(INK, 1.6)) + P('M9 16.5A16.5 16.5 0 0 1 18.5 7.6', 'none', ST('#fff', 1.6, '.28')) + '</g></svg>';

const mark = (type, cx, cy, s, color, eye) => {
  switch (type) {
    case 'star': return P(starD(cx, cy, s), color);
    case 'bolt': return P(boltD(cx, cy, s), color);
    case 'gem': case 'diamond': return P(gemD(cx, cy, s), color);
    case 'dot': return C(cx, cy, n1(s * 0.7), color);
    case 'ring': return C(cx, cy, n1(s * 0.72), 'none', ST(color, n1(s * 0.38)));
    case 'moon': return P(moonD(cx, cy, s), color);
    case 'x': return P('M' + n1(cx - s * 0.7) + ' ' + n1(cy - s * 0.7) + 'L' + n1(cx + s * 0.7) + ' ' + n1(cy + s * 0.7) + 'M' + n1(cx + s * 0.7) + ' ' + n1(cy - s * 0.7) + 'L' + n1(cx - s * 0.7) + ' ' + n1(cy + s * 0.7), 'none', ST(color, n1(s * 0.4)));
    case 'chev': return P('M' + n1(cx - s) + ' ' + n1(cy - s * 0.45) + 'L' + cx + ' ' + n1(cy + s * 0.45) + 'L' + n1(cx + s) + ' ' + n1(cy - s * 0.45), 'none', ST(color, n1(s * 0.45)));
    case 'sun': { let d = ''; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; d += 'M' + n1(cx + s * 0.75 * Math.cos(a)) + ' ' + n1(cy + s * 0.75 * Math.sin(a)) + 'L' + n1(cx + s * 1.15 * Math.cos(a)) + ' ' + n1(cy + s * 1.15 * Math.sin(a)); } return P(d, 'none', ST(color, n1(s * 0.25))) + C(cx, cy, n1(s * 0.5), color); }
    case 'eye': return E(cx, cy, n1(s * 1.1), n1(s * 0.7), color) + C(cx, cy, n1(s * 0.42), eye || '#22c55e', NS) + C(cx, cy, n1(s * 0.18), INK, NS);
    case 'atom': return E(cx, cy, s, n1(s * 0.38), 'none', ST(color, 0.8)) + '<g transform="rotate(60 ' + cx + ' ' + cy + ')">' + E(cx, cy, s, n1(s * 0.38), 'none', ST(color, 0.8)) + '</g><g transform="rotate(-60 ' + cx + ' ' + cy + ')">' + E(cx, cy, s, n1(s * 0.38), 'none', ST(color, 0.8)) + '</g>' + C(cx, cy, n1(s * 0.22), color, NS);
    case 'reactor': return C(cx, cy, n1(s * 1.3), color, NS + ' fill-opacity=".3"') + C(cx, cy, n1(s * 0.9), '#e0f2fe') + C(cx, cy, n1(s * 0.45), color, NS);
    default: return '';
  }
};

const parseSpec = spec => {
  const o = { H: 'none', R: '', E: 'human', M: 'line', K: [], X: [], A: [] };
  String(spec).trim().split(/\s+/).forEach(t => { const i = t.indexOf('='); if (i < 1) return; const k = t.slice(0, i), v = t.slice(i + 1); if (k === 'K' || k === 'X' || k === 'A') o[k] = v.split(','); else o[k] = v; });
  return o;
};

// Formes de base (viewBox 48) : tête centrée en (24, 21.5)
const HEAD = 'M24 11.1C29.4 11.1 32.8 15.4 32.8 21.5S29 31.9 24 31.9 15.2 27.6 15.2 21.5 18.6 11.1 24 11.1Z';
const SHOULDERS = 'M12.6 44C13.4 38.6 17.6 35.4 24 35.4S34.6 38.6 35.4 44A23 23 0 0 1 12.6 44Z';
const COWL = 'M15 27C14.4 16.4 17.6 10.6 24 10.6S33.6 16.4 33 27C31.2 25.4 29.6 24.6 28 24.8 26.8 25.6 25.4 26 24 26S21.2 25.6 20 24.8C18.4 24.6 16.8 25.4 15 27Z';
const HOOD = 'M12.6 35C11.6 20.6 15 8.2 24 8.2S36.4 20.6 35.4 35C33.4 32.6 32.6 29 32.6 23.4 32.6 16.6 29.2 12.4 24 12.4S15.4 16.6 15.4 23.4C15.4 29 14.6 32.6 12.6 35Z';
const HOOD_SHADE = 'M15.4 23.4C15.4 16.6 18.8 12.4 24 12.4S32.6 16.6 32.6 23.4C30.4 18.6 27.6 16.4 24 16.4S17.6 18.6 15.4 23.4Z';
const HELMET = 'M14.2 25C13.6 15 17.8 9.4 24 9.4S34.4 15 33.8 25V30.2C31 32.4 27.6 33.4 24 33.4S17 32.4 14.2 30.2Z';
const FACEPLATE = 'M17.4 18.4H30.6V27.2C29 30.2 26.6 31.6 24 31.6S19 30.2 17.4 27.2Z';
const FACEOPEN = 'M17.4 17.4H30.6V27.6C29 30.4 26.6 31.8 24 31.8S19 30.4 17.4 27.6Z';
const ROBOT = 'M15 13.4Q15 11 17.4 11H30.6Q33 11 33 13.4V28.6Q33 32 29.6 32H18.4Q15 32 15 28.6Z';
const DOME = 'M13 18.4C13 11.4 17.8 7.4 24 7.4S35 11.4 35 18.4 29.4 32.4 24 32.4 13 25.4 13 18.4Z';
const HALF_R = 'M24 11.1C29.4 11.1 32.8 15.4 32.8 21.5S29 31.9 24 31.9Z';
const EARS_COWL = {
  pointed: 'M16.4 15.4L15.8 5.6 20.6 11.8Z', cat: 'M16.2 14.2L16.6 7.6 21 11.4Z',
  horns: 'M18.6 12.4C17.4 10 17.2 7.6 18 5.8 19.6 7.8 21 9.8 21.8 11.2Z', fins: 'M16.4 18C13.6 15.4 11.6 11.8 11.4 8 14.2 10.8 16.8 12.4 19 13.4Z',
  wings: 'M15.6 19.4L10.6 16 11.6 19.6 10.2 22.4 15.4 23Z'
};

const hairBack = (R, c) => {
  const r = c.r;
  switch (R) {
    case 'long': case 'streak': return P('M14 20C13.6 12.4 18.2 8.8 24 8.8S34.4 12.4 34 20C34.6 27 35.6 32 37 37.2 33.6 37.8 31 36.4 29.8 33.4H18.2C17 36.4 14.4 37.8 11 37.2 12.4 32 13.4 27 14 20Z', r);
    case 'wild': return P('M12.4 23C10.6 15 15.6 7.2 24 7.2S37.4 15 35.6 23C36.4 27 35.4 30.6 33.4 32.4L32.6 22H15.4L14.6 32.4C12.6 30.6 11.6 27 12.4 23Z', r);
    case 'bob': return P('M14.4 21C13.8 12.8 18.4 9.4 24 9.4S34.2 12.8 33.6 21V29.6H29.6L30 23H18L18.4 29.6H14.4Z', r);
    case 'braids': return P('M14.6 21C14 12.6 18.6 9.4 24 9.4S34 12.6 33.4 21V34H30.4V23H17.6V34H14.6Z', r) + C(16.1, 35, 1.3, c.b) + C(31.9, 35, 1.3, c.b);
    case 'pigtails': return E(12.4, 26, 2.8, 5.2, c.X.includes('splithair') ? c.a : r) + E(35.6, 26, 2.8, 5.2, c.X.includes('splithair') ? c.b : r);
    case 'snakes': { let s = ''; [[15, 15, 10.6, 10, 9.6, 6.6], [19, 12, 16.6, 8, 17.4, 4.8], [24, 11, 24, 7, 25.6, 4], [29, 12, 31.4, 8, 30.6, 4.8], [33, 15, 37.4, 10, 38.4, 6.6]].forEach(([x1, y1, x2, y2, x3, y3]) => { s += LINE('M' + x1 + ' ' + y1 + 'Q' + x2 + ' ' + y2 + ' ' + x3 + ' ' + y3, r, 2) + C(x3, y3, 1.5, r); }); return s; }
    default: return '';
  }
};
const hairFront = (R, c) => {
  const r = c.r;
  const SHORT = P('M15.2 21C14.6 13.6 18.6 10 24 10S33.4 13.6 32.8 21C31.6 17.4 28.6 15.4 24 15.6S16.4 17.4 15.2 21Z', r);
  const LONGF = P('M15.2 21C14.6 13.4 18.6 9.8 24 9.8S33.4 13.4 32.8 21C31 17.6 27.4 14.8 22.6 15.4 19.6 15.8 16.8 18 15.2 21Z', r);
  switch (R) {
    case 'short': case 'pigtails': case 'braids': return SHORT;
    case 'curl': return SHORT + P('M23.4 15.4C21.6 16.4 21.8 18.6 23.6 18.6', 'none', ST(r, 1.4));
    case 'greytemples': return SHORT + MIR(P('M15.3 21C15 18.6 15.4 17 16.2 15.8L17.6 19.4Z', '#d1d5db', NS));
    case 'long': return LONGF;
    case 'streak': return LONGF + P('M21 15.6C19.6 16.4 17.4 18.2 16 20.6 16.4 16.8 18 14 20.2 12.6Z', '#f8fafc', NS);
    case 'wild': return P('M15.2 21.4L14.4 16 17.2 17 17.2 12.4 20.6 14.8 22.6 11 25 14.6 28 11.6 29.4 15.6 32.8 14.8 32.8 21.4C31 17.6 28 15.8 24 15.8S17 17.6 15.2 21.4Z', r);
    case 'spiky': return P('M15.2 21L13.2 13.6 17.4 14.6 16.8 8.8 21 12 23.6 6.6 26.2 11.8 30.4 8.6 30.4 14 34.8 12.8 32.8 21C31.2 17.2 28 15.4 24 15.6S16.8 17.2 15.2 21Z', r);
    case 'mohawk': return P('M21.6 16C21 11.4 22 7.6 24 5.4 26 7.6 27 11.4 26.4 16Z', r);
    case 'bun': return SHORT + C(24, 8.8, 3.4, r);
    case 'bob': return P('M15.2 20.4C15 13.6 18.8 10.2 24 10.2S33 13.6 32.8 20.4C30 18.6 27.2 18 24 18S18 18.6 15.2 20.4Z', r);
    case 'slick': return P('M15.2 20C14.8 13.4 18.6 10 24 10S33.2 13.4 32.8 20C31 16.6 28.4 15 26 15.2L24 18 22 15.2C19.6 15 17 16.6 15.2 20Z', r);
    default: return '';
  }
};

const accessory = (a, c) => {
  switch (a) {
    case 'tiara': return P('M16.2 16C19 14.2 21.4 13.6 24 13.6S29 14.2 31.8 16L31.2 17.6C28.6 16.4 26.4 16 24 16S19.4 16.4 16.8 17.6Z', c.b) + P(starD(24, 14.4, 2.4), '#dc2626', ST(INK, 0.7));
    case 'band': return P('M15.2 16.8C18 15.6 21 15 24 15S30 15.6 32.8 16.8V19C30 17.8 27 17.3 24 17.3S18 17.8 15.2 19Z', c.b) + P('M32.6 17.4L37.6 19.6 35.6 22.6Z', c.b);
    case 'crown': return P('M16.8 14L16 7.6 19.6 10.6 22 6 24 10 26 6 28.4 10.6 32 7.6 31.2 14Z', c.b) + C(24, 12.2, 1.1, '#dc2626', ST(INK, 0.6));
    case 'crownspikes': return P('M17 15.4C15 12.4 14.6 9 15.6 6.2 17.6 9 19.6 10.4 21.4 11.4L24 5 26.6 11.4C28.4 10.4 30.4 9 32.4 6.2 33.4 9 33 12.4 31 15.4 28.6 14.4 26.4 14 24 14S19.4 14.4 17 15.4Z', c.b);
    case 'halo': return E(24, 7.4, 7, 2, 'none', ST(INK, 3.4)) + E(24, 7.4, 7, 2, 'none', ST('#facc15', 1.6));
    case 'antennae': return LINE('M20.6 12.6C19.6 9 17.6 6.6 15.6 5.4M27.4 12.6C28.4 9 30.4 6.6 32.4 5.4', c.b, 1.3) + C(15.6, 5.4, 1.5, c.b) + C(32.4, 5.4, 1.5, c.b);
    case 'antlers': return MIR(LINE('M19 12.4C17.4 9 14.6 7.2 12 6.8M15.6 8.4L14.6 4.6M17.8 10.2L19.4 6.2', c.b, 1.6));
    case 'hornsbull': return MIR(P('M16.2 15.4C12.6 15 10.4 12.4 10.4 8.2 12.4 10.6 14.6 11.4 17.6 11.6Z', c.b));
    case 'stumps': return C(19.6, 12.8, 1.7, '#57534e') + C(28.4, 12.8, 1.7, '#57534e');
    case 'fin': return P('M20 12C20.8 8 23 4.6 26.8 3 25.8 6.6 26.6 9.8 28.6 12Z', c.s);
    case 'leaves': return [[18, 10.4, 3], [23, 8.2, 3.4], [28.6, 9.8, 3], [31.8, 13.8, 2.4], [15.2, 13.8, 2.4]].map(([x, y, r]) => C(x, y, r, c.b)).join('') + P('M20.6 6.8l2 2.2M26.8 7.4l1.4 2.4', 'none', ST('#14532d', 0.8));
    case 'hat': return P('M16.4 14.2C16.6 9.6 19.4 7.4 24 7.4S31.4 9.6 31.6 14.2C29 13.6 26.6 13.4 24 13.4S19 13.6 16.4 14.2Z', c.b) + P('M10.8 15.6C14 13.8 19 13 24 13S34 13.8 37.2 15.6C34 16.8 29 17.4 24 17.4S14 16.8 10.8 15.6Z', c.b) + P('M16.6 12.4C19 12 21.4 11.8 24 11.8S29 12 31.4 12.4', 'none', ST(INK, 1.4));
    case 'tophat': return P('M17.8 13.6V4.6H30.2V13.6Z', c.b) + P('M17.8 11.2h12.4v1.8H17.8z', '#dc2626', NS) + P('M13.4 14.6C16.6 13.4 20.2 12.8 24 12.8S31.4 13.4 34.6 14.6C31.4 15.8 27.8 16.2 24 16.2S16.6 15.8 13.4 14.6Z', c.b);
    case 'witchhat': return P('M17.4 14.6L24.6 2.4C26 4 27.6 4.4 29.8 3.8 27.4 6 27.6 9.4 30.6 14.6Z', c.b) + P('M12 16.2C16 14.4 20 13.8 24 13.8S32 14.4 36 16.2C32 17.4 28 17.8 24 17.8S16 17.4 12 16.2Z', c.b);
    case 'laurel': return MIR(LINE('M15.8 18C16.6 14.6 19.4 12.4 22.8 11.8', '#65a30d', 1.3) + E(17, 15.4, 1.6, 0.8, '#84cc16', NS) + E(19.6, 13, 1.6, 0.8, '#84cc16', NS));
    case 'hood': return P(HOOD, c.b) + P(HOOD_SHADE, '#000', NS + ' fill-opacity=".3"');
    case 'goggleup': return P('M15.2 15.4C18 14.4 21 14 24 14S30 14.4 32.8 15.4', 'none', ST(INK, 1.4)) + C(20.4, 14.2, 2.6, c.e, ST(c.b, 1.4)) + C(27.6, 14.2, 2.6, c.e, ST(c.b, 1.4));
    default: return '';
  }
};
const animalEars = (a, c) => {
  const fur = c.r || c.s, inner = c.b;
  switch (a) {
    case 'earsround': return MIR(C(16.6, 12.8, 3.6, fur) + C(16.6, 12.8, 1.7, c.m || inner, NS));
    case 'earswolf': return MIR(P('M16 15.6L15.4 4.8 21.4 11.4Z', fur) + P('M16.6 13.6L16.4 7.8 19.6 11.2Z', inner, NS));
    case 'earscat': return MIR(P('M16.2 14.4L16.8 7.2 21.2 11.6Z', fur) + P('M17 12.8L17.4 9.4 19.6 11.6Z', inner, NS));
    case 'tufts': return MIR(P('M16.4 13.6L14.4 6.6 20 10.8Z', fur));
    default: return '';
  }
};

const eyes = (Ek, c) => {
  const e = c.e || '#f8fafc';
  switch (Ek) {
    case 'none': return '';
    case 'human': case 'angry': return (Ek === 'angry' ? P('M17.8 17.6L22 19.4M30.2 17.6L26 19.4', 'none', ST(INK, 1.3)) : P('M17.8 18.4L21.8 17.8M26.2 17.8L30.2 18.4', 'none', ST(c.r && c.r !== '#f8fafc' ? c.r : INK, 1.2))) + E(20.2, 21.3, 1.05, 1.3, INK, NS) + E(27.8, 21.3, 1.05, 1.3, INK, NS) + C(20.6, 20.8, 0.35, '#fff', NS) + C(28.2, 20.8, 0.35, '#fff', NS);
    case 'lens': return MIR(P('M17 19.6C19 18.8 21.6 19.2 22.4 21 21.8 23.2 19 23.6 17.4 22.4 16.8 21.6 16.6 20.4 17 19.6Z', e, ST(INK, 1.4)));
    case 'slit': return MIR(P('M17.4 20.4L22.4 21.8 21.8 23 17.8 21.8Z', e, NS));
    case 'glow': return MIR(E(20.2, 21.4, 3.2, 2.1, e, NS + ' fill-opacity=".35"') + E(20.2, 21.4, 2, 1.25, e, NS) + E(20.2, 21.4, 0.9, 0.5, '#fff', NS));
    case 'domino': return P('M15.6 19.4C18 18 21 18.6 24 20 27 18.6 30 18 32.4 19.4 32.2 22.8 30 24 27.6 23.8 26 23.6 25 22.6 24 22.6S22 23.6 20.4 23.8C18 24 15.8 22.8 15.6 19.4Z', c.m || INK) + MIR(P('M18.2 21.2C19 20.2 21 20.2 21.8 21.4 21 22.4 19 22.4 18.2 21.2Z', e, NS));
    case 'visor': return P('M15.8 19H32.2V22.8C29.4 23.8 26.8 24.2 24 24.2S18.6 23.8 15.8 22.8Z', e) + P('M17.6 20.4h7', 'none', ST('#fff', 0.9, '.6'));
    case 'goggles': return P('M15.4 20.6H32.6', 'none', ST(INK, 1.6)) + MIR(C(20.2, 21.2, 3, e, ST(c.b || INK, 1.6)) + C(19.2, 20.2, 0.8, '#fff', NS + ' fill-opacity=".7"'));
    case 'cyclops': return C(24, 21, 4, '#f8fafc', ST(INK, 1.3)) + C(24, 21, 2.2, e, NS) + C(24, 21, 1, INK, NS) + C(24.8, 20.2, 0.5, '#fff', NS);
    case 'void': return MIR(E(20.2, 21.6, 2.4, 2.8, '#14141c', NS) + C(20.2, 21.8, 0.8, e, NS));
    case 'jagged': return MIR(P('M15.6 16.8C18.6 17.4 21.4 19 22.6 21.8 21.2 24.6 18.4 26 15.4 25.2 17 23.4 16.4 20.8 15.6 16.8Z', e, ST(INK, 1.2)));
    case 'alien': return MIR(P('M15.6 18.6C18.8 18.4 22 19.6 22.6 22.6 19.6 24 16.6 22.4 15.6 18.6Z', '#0b0b12', NS) + E(18.4, 20, 0.9, 0.5, '#fff', NS + ' fill-opacity=".7"'));
    case 'patches': return MIR(P('M15.8 18.4C18.6 17.6 21.8 18.6 22.6 21.4 22 24 19 24.8 16.4 23.6 15.4 22.2 15.2 20 15.8 18.4Z', c.b || INK) + P('M17.8 20.8C19 20.2 20.6 20.4 21.2 21.4 20.2 22.2 18.6 22 17.8 20.8Z', e, NS));
    case 'ninja': return P('M16 19.2H32V23.6H16Z', c.s) + P('M17.8 19.8L21.8 20.6M26.2 20.6L30.2 19.8', 'none', ST(INK, 1.1)) + E(20.2, 21.8, 1, 1.1, INK, NS) + E(27.8, 21.8, 1, 1.1, INK, NS);
    case 'closed': return P('M18.2 21.4C19.4 22.6 21 22.6 22.2 21.4M25.8 21.4C27 22.6 28.6 22.6 29.8 21.4', 'none', ST(INK, 1.2));
    case 'patch': return P('M15.4 17.6L32.6 15.4', 'none', ST(INK, 1)) + E(20.2, 21.3, 2.6, 2.2, INK, NS) + P('M26.2 17.8L30.2 18.4', 'none', ST(INK, 1.2)) + E(27.8, 21.3, 1.05, 1.3, INK, NS);
    default: return '';
  }
};
const mouth = (Mk, c) => {
  switch (Mk) {
    case 'line': return P('M21.8 28.6h4.4', 'none', ST(INK, 1.2));
    case 'smile': return P('M21 27.8C22.6 29.6 25.4 29.6 27 27.8', 'none', ST(INK, 1.2));
    case 'stern': return P('M21.4 28.8h5.2', 'none', ST(INK, 1.4));
    case 'frown': return P('M21.4 29.6C22.8 28.2 25.2 28.2 26.6 29.6', 'none', ST(INK, 1.3));
    case 'grin': return P('M18.6 26.6C21 30.8 27 30.8 29.4 26.6 26 28.4 22 28.4 18.6 26.6Z', '#be123c', ST(INK, 1)) + P('M20 27.6C22.6 28.6 25.4 28.6 28 27.6', 'none', ST('#fff', 0.9));
    case 'fangs': return P('M18.6 26.4C21 31 27 31 29.4 26.4Z', '#14141c') + P('M20 27L21 29 22 27.4ZM26 27.4L27 29 28 27Z', '#fff', NS);
    case 'teeth': return P('M20.2 27.4h7.6v3h-7.6z', '#fff', ST(INK, 0.9)) + P('M22.1 27.4v3M24 27.4v3M25.9 27.4v3', 'none', ST(INK, 0.7));
    case 'slot': return P('M19.6 27.4h8.8v1.8h-8.8z', (c && c.e) || '#ef4444');
    case 'grill': return P('M21 27.4v3M23 27.4v3.4M25 27.4v3.4M27 27.4v3', 'none', ST(INK, 1));
    case 'stitch': return P('M19.6 28.2h8.8M20.6 27v2.4M22.8 27v2.4M25.2 27v2.4M27.4 27v2.4', 'none', ST(INK, 0.9));
    default: return '';
  }
};
const faceExtra = (x, c) => {
  switch (x) {
    case 'beard': return P('M15.4 23.6C15.8 31 19.6 34.4 24 34.4S32.2 31 32.6 23.6C31.4 27.2 28.6 28.4 24 28.6S16.6 27.2 15.4 23.6Z', c.r);
    case 'mustache': return P('M19.6 27.4C21.4 25.8 23 26 24 27 25 26 26.6 25.8 28.4 27.4 26.6 28 25 28.4 24 27.8 23 28.4 21.4 28 19.6 27.4Z', c.r);
    case 'goatee': return P('M22 29.8h4l-.8 3.2h-2.4z', c.r);
    case 'stubble': return P('M16.2 25C16.8 30.2 20 32.6 24 32.6S31.2 30.2 31.8 25C30 28.6 27.4 29.8 24 29.8S18 28.6 16.2 25Z', c.r || INK, NS + ' fill-opacity=".28"');
    case 'scar': return P('M28.6 16.8L26.6 25.4', 'none', ST('#be123c', 1, '.85'));
    case 'snout': return E(24, 27.4, 4.6, 3.4, c.b) + P('M22.4 25.6h3.2L24 27.4Z', INK, NS);
    case 'beak': return P('M21 24.6H27L24 30.4Z', '#f5c518');
    case 'whiskers': return MIR(P('M19.6 27.6L14.4 26.4M19.6 28.6L14.6 29.4', 'none', ST(INK, 0.6)));
    case 'chinlines': return P('M20.4 29.4v2.2M22.2 30.2v2M25.8 30.2v2M27.6 29.4v2.2', 'none', ST(INK, 0.8, '.6'));
    case 'tattoo': return P('M18 12.6C19.4 15.4 19.6 18 18.6 19.8M30 12.6C28.6 15.4 28.4 18 29.4 19.8M24 11.4V16', 'none', ST('#dc2626', 1.2));
    case 'rock': return P('M17 15l4 2 1-4M27 13l1 4 4-1M16 24l4 1 1 4M32 24l-4 1-1 4M21 19.6h6', 'none', ST(INK, 0.8, '.4'));
    case 'bark': return P('M19 13v5M24 12v3M29 13v5M17.6 24v4M30.4 24v4', 'none', ST('#451a03', 0.9, '.7'));
    case 'scales': return P('M18 15c1 1 2 1 3 0M23 13c1 1 2 1 3 0M27 15c1 1 2 1 3 0M17 25c1 1 2 1 3 0M28 25c1 1 2 1 3 0', 'none', ST(INK, 0.7, '.45'));
    case 'stripes': return MIR(P('M15.6 18.4L19 19.4M15.4 22.2L18.6 22.4M16.4 26L19 25.2', 'none', ST(INK, 1.1))) + P('M24 11.2V14.6', 'none', ST(INK, 1.1));
    case 'paint': return MIR(P('M17.8 23.8L21.2 24.4', 'none', ST(c.b, 1.4)));
    case 'freckles': return MIR(C(19, 24.6, 0.4, '#92400e', NS) + C(20.4, 25.2, 0.4, '#92400e', NS) + C(18.2, 25.6, 0.4, '#92400e', NS));
    case 'seam': return P('M24 11.2V31.8', 'none', ST(c.b, 1));
    case 'stitches': return P('M17 16.4l14 1.6M18 15.2l-.6 2.4M22 15.6l-.4 2.6M26 16l-.4 2.6M30 16.6l-.6 2.4', 'none', ST(INK, 0.7));
    case 'wraps': return P('M15.6 16.4L32.4 18.2M15.2 24L32.8 22.4M16.6 28.6L31.4 29.8M17.4 13.2l13.4 1.4', 'none', ST('#a8a29e', 0.9));
    case 'blots': return P('M18.4 17.6C20.8 16.6 22.4 18.6 21.6 20.6 20.8 22.6 18.6 23.4 17.6 21.6 16.8 20.2 17 18.2 18.4 17.6ZM29.6 17.6C27.2 16.6 25.6 18.6 26.4 20.6 27.2 22.6 29.4 23.4 30.4 21.6 31.2 20.2 31 18.2 29.6 17.6ZM22.6 26.4C23.6 25.4 24.8 25.6 25.4 26.8 25.8 28.2 24.6 29.4 23.4 29 22.2 28.6 22 27.2 22.6 26.4Z', INK, NS);
    case 'skull': return P('M23 23.8L24 25.8 25 23.8Z', INK, NS) + MIR(P('M16.2 25.2C17.2 26.6 18.6 27.4 19.8 27.6', 'none', ST(INK, 0.7, '.5')));
    case 'brow': return P('M16.6 18C19 16.6 21.6 16.6 24 17.6 26.4 16.6 29 16.6 31.4 18', 'none', ST(INK, 1.6));
    default: return '';
  }
};
const postEyes = (x, c) => {
  switch (x) {
    case 'halfmetal': return P(HALF_R, '#94a3b8') + P('M24 15h5.6M24 26h6.4M28.6 15v4', 'none', ST(INK, 0.7, '.6')) + C(27.8, 21.3, 2.2, c.b || '#ef4444', NS + ' fill-opacity=".35"') + C(27.8, 21.3, 1.3, c.b || '#ef4444', NS);
    case 'halfscar': return P(HALF_R, '#7c3aed', NS + ' fill-opacity=".45"') + P('M25.6 14l2 3-1 3 2 3M25 26l3 2', 'none', ST(INK, 0.7, '.7')) + C(27.8, 21.3, 2, '#fff', ST(INK, 1)) + C(27.8, 21.3, 0.9, INK, NS);
    default: return '';
  }
};

const renderHead = (spec, c) => {
  const S = parseSpec(spec); const col = Object.assign({}, c, { X: S.X });
  const [hg, ...hv] = S.H.split('.');
  const masked = hg === 'full' || hg === 'robot';
  const helmet = hg === 'helmet', open = hv.includes('open');
  let o = badgeOpen(c.bg);
  // Arrière-plan : flammes, ailes, cape, col, cheveux longs
  if (S.A.includes('flame')) o += P('M14 26C11 19.4 13 13.4 16 9.6 16.6 12.6 18 13.6 19 14 19 9.4 21.4 5.6 24.4 3 24.8 7 26.6 9.2 28.2 11.2 29 8.6 30.6 7.4 32.6 6.6 32.2 10.4 35.8 14.6 34.4 26Z', '#f97316') + P('M16.6 24C15.4 19.4 17 15.8 18.8 13.6 19.6 15.6 20.8 16.2 21.6 16.4 22 12.8 23.6 10 25.2 8.4 25.8 11.6 27.2 13.4 28.4 14.8 29.4 13 30.6 12.2 31.6 12 31.4 15 33 17.6 31.6 24Z', '#fde047', NS);
  if (S.X.includes('wingsback')) o += MIR(P('M18 26C12 24 7.4 19.6 6.6 12.6 10.6 16 14.6 17.4 18.6 17.6Z', c.b) + P('M18.4 31C12.2 31 8.2 28 6.2 22.6 10.4 25 14.4 25.4 18.4 25Z', c.b));
  if (S.X.includes('cape')) o += P('M11.2 44C10.4 36 13.6 31.4 20 31.6H28C34.4 31.4 37.6 36 36.8 44Z', c.b);
  if (S.X.includes('collar')) o += MIR(P('M14.4 37.6L11.4 24.6 19 33.4Z', c.b));
  if (hg !== 'cowl' || S.R === 'long') o += hairBack(S.R, col);
  // Corps et marque de poitrine
  o += P(SHOULDERS, c.a);
  S.K.filter(k => k.startsWith('c-')).forEach(k => { const [t, cl] = k.slice(2).split(':'); o += mark(t, 24, 41.2, 3, colorOfTok(cl) || c.b, c.e); });
  if (S.X.includes('necklace')) o += P('M17.6 36.6C20 39 22 39.8 24 39.8S28 39 30.4 36.6', 'none', ST(c.b, 1.2)) + [19.4, 22, 24, 26, 28.6].map((x, i) => P('M' + n1(x - 0.7) + ' ' + (i === 0 || i === 4 ? 38.2 : 39.4) + 'l.7 1.8.7-1.8z', c.b, NS)).join('');
  if (S.X.includes('spikes')) o += MIR(P('M15 36.8L12.6 31.2 17.4 34.4Z', '#9ca3af'));
  o += P('M20.4 28h7.2v8h-7.2z', masked || helmet ? c.a : c.s);
  // Oreilles
  S.A.forEach(a => { o += animalEars(a, col); });
  if (!masked && !helmet && hg !== 'cowl' && !S.A.some(a => /^ears|tufts/.test(a))) o += S.X.includes('elfears') ? MIR(P('M15.8 24.6C14 24 12.4 21.4 11.8 16.8 13.8 18.6 15.4 19.6 16 20.4Z', c.s)) : MIR(E(15.4, 22.4, 1.6, 2.6, c.s));
  if ((hg === 'cowl' || hg === 'full') && hv[0] && EARS_COWL[hv[0]]) o += MIR(P(EARS_COWL[hv[0]], hv[0] === 'wings' ? c.b : c.a));
  // Tête
  const ghost = S.X.includes('ghost');
  if (ghost) o += '<g opacity=".6">';
  if (hg === 'robot') o += P(ROBOT, c.a) + MIR(C(14.6, 22, 1.6, c.b));
  else if (hg === 'dome') o += P(DOME, c.s);
  else o += P(HEAD, masked ? c.a : c.s);
  if (hg === 'full' && hv.includes('split')) o += P(HALF_R, c.b, NS) + P(HEAD, 'none');
  if (hg === 'full' && hv.includes('seam')) o += faceExtra('seam', col);
  ['bark', 'rock', 'scales', 'tattoo', 'stripes', 'chinlines', 'wraps', 'blots', 'stitches', 'skull', 'freckles', 'stubble'].forEach(x => { if (S.X.includes(x)) o += faceExtra(x, col); });
  // Cheveux, coiffe
  if (hg !== 'cowl' && !helmet && !masked) o += hairFront(S.R, col);
  if (hg === 'cowl') o += P(COWL, c.a);
  if (helmet) {
    o += P(HELMET, c.a);
    o += open ? P(FACEOPEN, c.s) : P(FACEPLATE, c.b);
    if (hv.includes('wings')) o += MIR(P('M14.6 17.4C10.8 15.4 8.6 12.2 8.4 8.6 11.2 11.6 13.2 12.8 15.2 13.4Z', '#e5e7eb') + P('M14.4 21C11 20.2 8.6 18.4 7.6 15.8 10.6 17.4 12.6 17.8 14.6 17.6Z', '#e5e7eb'));
    if (hv.includes('horns')) o += MIR(P('M17 12.6C14.2 9.8 12.8 6 13.8 2.8 15.4 6.2 17.4 8.4 19.8 10Z', c.b));
    if (hv.includes('crest') || hv.includes('fins3')) o += P('M22.4 9.8C22 6.2 22.8 3.4 24 2 25.2 3.4 26 6.2 25.6 9.8Z', c.b);
    if (hv.includes('fins3')) o += MIR(P('M17.6 12.6L15.4 6 19.6 9.6Z', c.b));
    if (hv.includes('crestbig')) o += P('M17 11C17.6 5.6 20.6 2.6 24 2.6S30.4 5.6 31 11C28.4 9.4 26.4 8.8 24 8.8S19.6 9.4 17 11Z', c.b);
    if (hv.includes('prongs')) o += MIR(P('M14.6 16L12 4.6 16.4 6.4 17.4 12.6Z', c.b));
    if (hv.includes('crescent')) o += P('M16 9.6C17.4 12.4 20.4 13.4 24 13.4S30.6 12.4 32 9.6C31.4 13.6 28 15.6 24 15.6S16.6 13.6 16 9.6Z', c.b);
  }
  if (hg === 'hood') o += P(HOOD, c.a) + P(HOOD_SHADE, '#000', NS + ' fill-opacity=".3"');
  if (hg === 'nemes') o += P('M14.6 20C14.6 12.6 18.6 9.6 24 9.6S33.4 12.6 33.4 20L36 36H30.8L30.4 22.4C28.6 20.6 26.4 19.8 24 19.8S19.4 20.6 17.6 22.4L17.2 36H12Z', c.a) + MIR(P('M13.8 25.4h3.4M13.2 29.6h3.6M12.6 33.8h4', 'none', ST(c.b, 1.2))) + P('M16 16.4C18.6 15.4 21.2 15 24 15S29.4 15.4 32 16.4', 'none', ST(c.b, 1.6));
  ['beard', 'mustache', 'goatee', 'snout', 'beak', 'whiskers', 'scar', 'paint', 'brow'].forEach(x => { if (S.X.includes(x)) o += faceExtra(x, col); });
  // Regard, bouche
  o += eyes(S.E, col);
  ['halfmetal', 'halfscar'].forEach(x => { if (S.X.includes(x)) o += postEyes(x, col); });
  o += mouth(S.M, col);
  // Accessoires au premier plan, verre du casque d'astronaute, marques du front
  S.A.forEach(a => { if (!/^ears|tufts|flame/.test(a)) o += accessory(a, col); });
  if (hg === 'bubble') o += C(24, 21.6, 13, '#bae6fd', NS + ' fill-opacity=".22"') + C(24, 21.6, 13, 'none', ST(INK, 1.4)) + P('M15.4 15.4A10.6 10.6 0 0 1 21.6 10.2', 'none', ST('#fff', 1.6, '.75')) + P('M13.2 30.4C16.4 33.2 20 34.4 24 34.4S31.6 33.2 34.8 30.4V34.6C31.6 37 27.8 38 24 38S16.4 37 13.2 34.6Z', c.a);
  S.K.filter(k => !k.startsWith('c-')).forEach(k => { const [t, cl] = k.split(':'); o += mark(t, 24, 14.8, 2.4, colorOfTok(cl) || c.b, c.e); });
  if (ghost) o += '</g>';
  return o + badgeClose();
};

// ---------------------------------------------------------------- Artefacts : dessins (objets génériques)
const ART_DRAW = {
  hammer: (a, b, c) => '<g transform="rotate(-24 24 25)">' + P('M21.8 22.6h4.4v14h-4.4z', c || '#92400e') + P('M22 26.4h4M22 29.4h4M22 32.4h4', 'none', ST(INK, 0.7, '.6')) + P('M20.6 36.4h6.8v3.6h-6.8z', a) + P('M12.4 11.6h23.2v11.4H12.4z', a) + P('M16.8 11.6v11.4M31.2 11.6v11.4', 'none', ST(b, 1.6)) + P('M22 15.4l2 3 2-3', 'none', ST('#38bdf8', 1.2)) + '</g>',
  shield: (a, b, c) => C(24, 24, 14, a) + C(24, 24, 10.4, b) + C(24, 24, 6.8, a) + C(24, 24, 4.8, c) + P(starD(24, 24, 4.4), b, NS) + P('M14.4 15.4A12 12 0 0 1 20 11.4', 'none', ST('#fff', 1.4, '.5')),
  trident: a => LINE('M24 18V42', a, 2.4) + LINE('M15.6 9V14.6C15.6 18 19.4 19.6 24 19.6S32.4 18 32.4 14.6V9M24 6.6V19.6', a, 2.2) + P('M13.8 10.4L15.6 5.2 17.4 10.4ZM22.2 8L24 2.8 25.8 8ZM30.6 10.4L32.4 5.2 34.2 10.4Z', a),
  lasso: (a, b) => C(24, 23, 13, b, NS + ' fill-opacity=".18"') + LINE('M24 14.4C31.6 14.4 36.6 18 36.6 22.2S31.6 30 24 30 11.4 26.4 11.4 22.2 16.4 14.4 24 14.4Z', a, 2) + LINE('M24 17.6C29.6 17.6 33.4 19.8 33.4 22.6S29.6 27.6 24 27.6 14.6 25.4 14.6 22.6 18.4 17.6 24 17.6Z', a, 1.6) + LINE('M30.4 29.4C31.4 33.6 29.4 37.6 25.6 40.6', a, 2),
  ring: (a, b) => C(24, 24, 15, b, NS + ' fill-opacity=".2"') + C(24, 28, 7.6, 'none', ST(INK, 5.6)) + C(24, 28, 7.6, 'none', ST(a, 3.4)) + P('M24 10.4l4.4 4.6-4.4 5-4.4-5z', b) + P('M22.4 13.4l1.6-1.4', 'none', ST('#fff', 1, '.8')),
  gauntlet: (a, b) => P('M17 35.4H31.6V41.6H17Z', b) + P('M14.6 27.4V18.6C14.6 17 15.6 16 17 16S19.4 17 19.4 18.6V15.6C19.4 14 20.4 13 21.8 13S24.2 14 24.2 15.6V15C24.2 13.4 25.2 12.4 26.6 12.4S29 13.4 29 15V17.2C29 15.8 30 14.8 31.2 14.8S33.4 15.8 33.4 17.2V27C33.4 32.4 29.6 36 24.4 36S14.6 32.6 14.6 27.4Z', a) +
    [[17, 19.6, '#3b82f6'], [21.8, 16.6, '#ef4444'], [26.6, 16, '#a855f7'], [31.2, 18.4, '#facc15'], [24.2, 26.6, '#f97316'], [24.2, 38.6, '#22c55e']].map(([x, y, cl], i) => C(x, y, i === 4 ? 2.6 : 1.4, cl, ST(INK, 0.8))).join(''),
  cube: (a, b, c) => C(24, 25, 16, a, NS + ' fill-opacity=".22"') + P('M24 10.4L35.4 16.6 24 22.8 12.6 16.6Z', c) + P('M12.6 16.6L24 22.8V36.4L12.6 30.2Z', a) + P('M35.4 16.6L24 22.8V36.4L35.4 30.2Z', b) + P('M15 18.6l6.6 3.6', 'none', ST('#fff', 1, '.6')),
  amulet: (a, b) => P('M14 9.6C16 17 20 20.4 24 20.4S32 17 34 9.6', 'none', ST(a, 1.2)) + C(24, 28.4, 9, a) + C(24, 28.4, 6.6, '#7c2d12', NS + ' fill-opacity=".35"') + P('M17.6 28.4C20.6 24.8 27.4 24.8 30.4 28.4 27.4 32 20.6 32 17.6 28.4Z', '#f8fafc') + C(24, 28.4, 2.6, b, NS) + C(24, 28.4, 1.1, INK, NS),
  lantern: (a, b) => C(24, 25, 14, b, NS + ' fill-opacity=".25"') + P('M19.6 12.2C19.6 8 28.4 8 28.4 12.2', 'none', ST(INK, 1.4)) + P('M18.6 12.4h10.8l-1.4 3H20z', a) + P('M19 15.4h10l1.4 15.2H17.6z', b) + P('M21.6 17.6v10', 'none', ST('#fff', 1, '.6')) + P('M16.6 30.6h14.8v3.6H16.6z', a) + P('M18.4 34.2h11.2l-1.4 3H19.8z', a),
  book: (a, b) => P('M15.6 36.4V33.4H34.6V36.4Z', '#f8fafc') + P('M13.4 12.6H32.4Q34.6 12.6 34.6 14.8V33.4H15.6Q13.4 33.4 13.4 31.2Z', a) + P('M30.6 20.4h5.4v5.2h-5.4z', b) + mark('eye', 23, 23, 3.6, b, '#a855f7') + P('M17 15.4h12', 'none', ST(b, 1)),
  sword: (a, b, c) => P('M24 3.4L27.2 8.2V30H20.8V8.2Z', b, ST(INK, 1.2)) + P('M24 6.4V29', 'none', ST('#fff', 0.9, '.8')) + P('M14.8 29.6h18.4v3.4H14.8z', a) + P('M22.4 33h3.2v6.6h-3.2z', c || '#7c2d12') + C(24, 41.4, 2.2, a),
  bow: (a, b) => P('M17.2 7.6V40.4', 'none', ST(INK, 0.9)) + LINE('M17.2 7.6C27.4 13 27.4 35 17.2 40.4', a, 2.6) + LINE('M11 24H35.2', b, 1.4) + P('M35 20.8L39.8 24 35 27.2Z', b) + P('M11 24l-2.6-3M11 24l-2.6 3M13.4 24l-2.6-3M13.4 24l-2.6 3', 'none', ST('#dc2626', 1.2)),
  boomerang: (a, b) => '<g transform="rotate(-8 24 24)">' + P('M12.6 34.6L21.6 12.6C22.2 11 24.4 10.8 25.2 12.4L36 33.6C36.6 35 35.2 36.2 33.8 35.4L25.4 30.4C24.6 29.9 23.6 29.9 22.8 30.4L14.8 36.4C13.6 37.4 12 36.2 12.6 34.6Z', a) + P('M16 32L22.6 15.6M32.4 32L25.6 16', 'none', ST(b, 1.6)) + '</g>',
  helmet: (a, b, c) => MIR(P('M14.6 25.4C10.8 23.4 8.6 20.2 8.4 16.6 11.2 19.6 13.2 20.8 15.2 21.4Z', c) + P('M14.4 29C11 28.2 8.6 26.4 7.6 23.8 10.6 25.4 12.6 25.8 14.6 25.6Z', c)) + P('M14.6 32C14.6 21.4 18.8 14.4 24 14.4S33.4 21.4 33.4 32Z', a) + P('M13.6 31.4h20.8v4H13.6z', b) + P('M18 22.4C18.8 19.6 20.6 17.6 23 17', 'none', ST('#fff', 1.4, '.6')),
  cape: (a, b, c) => P('M17 10.6C14.2 20 12 30 10 40.4 15 38.6 19 41.6 24 39.8 29 41.6 33 38.6 38 40.4 36 30 33.8 20 31 10.6Z', a) + P('M21 12.6C20 21 19.8 30 20.4 39.2M27 12.6C28 21 28.2 30 27.6 39.2', 'none', ST(b, 1.2, '.8')) + P('M16.4 9h15.2v3.4H16.4z', b) + C(18.4, 10.7, 2.2, c) + C(29.6, 10.7, 2.2, c),
  belt: (a, b, c) => P('M8.4 21.2H39.6V28.8H8.4Z', a) + [10, 14.8, 29.2, 34].map(x => P('M' + x + ' 19.4h4v9.6h-4z', c)).join('') + P('M20 19h8v11h-8z', b) + C(24, 24.5, 2.4, c),
  crown: (a, b, c) => P('M11.6 33.4L10 15.6 17 22 24 11.2 31 22 38 15.6 36.4 33.4Z', a) + P('M11.6 33.4h24.8v3.6H11.6z', a) + C(24, 27, 2.2, b) + C(17, 29, 1.5, c) + C(31, 29, 1.5, c) + C(10, 15.6, 1.4, a) + C(24, 11.2, 1.4, a) + C(38, 15.6, 1.4, a),
  orb: (a, b) => C(24, 24, 15, a, NS + ' fill-opacity=".25"') + C(24, 24, 11.4, a) + P('M17 22C19 16 28 15.4 30.4 21 32.4 26 27 30 23.4 27.6 20.6 25.8 22.6 22.2 25.4 23.4', 'none', ST(b, 1.6)) + E(19.6, 17.6, 2.6, 1.6, '#fff', NS + ' fill-opacity=".45"'),
  scepter: (a, b) => C(24, 13, 9, b, NS + ' fill-opacity=".25"') + P('M22.8 19.4h2.4v22h-2.4z', a) + P('M18 19.4C18 14 20 12.4 24 12.4S30 14 30 19.4C28 17.6 26 17 24 17S20 17.6 18 19.4Z', a) + P('M24 5L28.4 11 24 17.6 19.6 11Z', b) + C(24, 41.6, 1.8, a),
  staff: (a, b) => C(24.6, 10, 9, b, NS + ' fill-opacity=".3"') + LINE('M27.6 42C26 35 22 31 22.4 23.6S25.4 14.6 24.4 10', a, 2.8) + C(24.6, 9.4, 4.4, b) + C(23.2, 8, 1.2, '#fff', NS + ' fill-opacity=".8"'),
  potion: (a, b, c) => P('M21 8.6h6V16L32.6 30.4C34 34.4 31.4 38.6 27 38.6H21C16.6 38.6 14 34.4 15.4 30.4L21 16Z', b) + P('M17.2 27.4H30.8L32.6 31C33.6 34.4 31.4 37 27.4 37H20.6C16.6 37 14.4 34.4 15.4 31Z', a, NS) + P('M21 8.6h6V16L32.6 30.4C34 34.4 31.4 38.6 27 38.6H21C16.6 38.6 14 34.4 15.4 30.4L21 16Z', 'none') + P('M20.4 6h7.2v3.2h-7.2z', c) + C(22, 32, 1.2, '#fff', NS + ' fill-opacity=".7"') + C(26, 30, 0.8, '#fff', NS + ' fill-opacity=".7"'),
  hourglass: (a, b) => P('M16.4 11.4H31.6C31.6 18 26.4 21 26.4 24S31.6 30 31.6 36.6H16.4C16.4 30 21.6 27 21.6 24S16.4 18 16.4 11.4Z', b) + P('M18.6 14.4h10.8C28.4 18 25.6 20.4 24 22 22.4 20.4 19.6 18 18.6 14.4Z', a, NS) + P('M18 35.2C19.4 31 22 30 24 29.6 26 30 28.6 31 30 35.2Z', a, NS) + P('M24 22v7.6', 'none', ST(a, 0.8)) + P('M13.6 8h20.8v3.4H13.6zM13.6 36.6h20.8V40H13.6z', a),
  ironmask: (a, b) => P(HOOD, b) + P(HEAD, a) + MIR(P('M17.4 20.4L22.4 21.8 21.8 23 17.8 21.8Z', INK, NS)) + mouth('grill') + P('M24 12v7', 'none', ST(INK, 0.8, '.5')) + P('M17.6 14.4C19 13 20.6 12.4 22 12.2', 'none', ST('#fff', 1, '.55')),
  crystal: (a, b) => C(24, 26, 15, a, NS + ' fill-opacity=".22"') + P('M16.6 16.4L20.6 22 19.8 38H15.2L13.2 23Z', b) + P('M31.4 16.4L34.8 23 32.8 38H28.2L27.4 22Z', b) + P('M24 6L29.4 16 27 38H21L18.6 16Z', a) + P('M24 9l-2.4 8 1 18', 'none', ST('#fff', 1, '.6')),
  reactor: (a, b) => C(24, 24, 15, a, NS + ' fill-opacity=".25"') + C(24, 24, 11, '#1f2937') + C(24, 24, 8, 'none', ST(a, 2.4)) + Array.from({ length: 10 }, (_, i) => { const t = i * Math.PI / 5; return P('M' + n1(24 + 8 * Math.cos(t)) + ' ' + n1(24 + 8 * Math.sin(t)) + 'L' + n1(24 + 10.4 * Math.cos(t)) + ' ' + n1(24 + 10.4 * Math.sin(t)), 'none', ST(b, 1)); }).join('') + C(24, 24, 4, b) + C(24, 24, 2, '#fff', NS),
  board: (a, b) => P(starD(12, 12, 2.6), '#fff', NS + ' fill-opacity=".8"') + P(starD(37, 33, 2), '#fff', NS + ' fill-opacity=".7"') + P('M7 35C13 24 28 12.6 41 11.6 37 22.4 22 34.6 7 35Z', a) + P('M11.6 31.8C18 24.4 28 17 37 14.6', 'none', ST(b, 1.2)) + P('M14 30.2C19.4 25 25 21 30.4 18.4', 'none', ST('#fff', 1, '.6')),
  claws: (a, b) => [0, 6.4, 12.8].map(dx => P('M' + n1(15.4 + dx) + ' 35L' + n1(16 + dx) + ' 8.4C' + n1(17.8 + dx) + ' 11.6 ' + n1(18.8 + dx) + ' 23.6 ' + n1(18.6 + dx) + ' 35Z', a)).join('') + P('M16.6 12v20M23 12v20M29.4 12v20', 'none', ST('#fff', 0.8, '.6')) + P('M12.6 34.2h22.8v6H12.6z', b),
  magnifier: (a, b) => LINE('M27.6 27.6l9.4 9.4', a, 4) + C(21, 21, 9.4, b, ST(INK, 1.4)) + C(21, 21, 9.4, 'none', ST(a, 2.6)) + P('M15.4 18.4A6.4 6.4 0 0 1 19.4 14.8', 'none', ST('#fff', 1.4, '.8')),
  key: (a, b) => C(17, 17, 9, b, NS + ' fill-opacity=".25"') + C(17, 17, 6.4, 'none', ST(INK, 5.2)) + C(17, 17, 6.4, 'none', ST(a, 3)) + LINE('M21.8 21.8L36.4 36.4M31.4 31.4l-3 3M34.6 34.6l-3 3', a, 2.6) + P(gemD(17, 17, 2.4), b),
  comic: (a, b, c) => P('M15.6 9.6h20v31h-20z', INK, NS + ' fill-opacity=".35"') + P('M13.4 7.6h20v31h-20z', a) + P('M13.4 7.6h20v7.4h-20z', b) + P(starD(23.4, 27, 8.4), c) + P(starD(23.4, 27, 5), b, NS) + P('M15.6 10.4h7M15.6 12.4h4.4', 'none', ST(a, 1.2)),
  compass: (a, b) => C(24, 24, 13.6, a) + C(24, 24, 10.6, '#f8fafc') + P('M24 13.4L26.6 24H21.4Z', b, NS) + P('M24 34.6L21.4 24H26.6Z', '#1f2937', NS) + C(24, 24, 1.6, a) + P('M24 13v1.8M24 33.2V35M13 24h1.8M33.2 24H35', 'none', ST(INK, 1)),
  scythe: (a, b) => LINE('M30 8.4L19.4 42', b, 2.6) + P('M30.2 8.6C23.4 5.2 14 6.6 8.6 13.6 14.4 11.6 21.4 12 28.4 15.4Z', a) + P('M12.6 11.4C17.4 9 22.6 9 27.2 10.6', 'none', ST('#fff', 0.9, '.7')),
  crystalball: (a, b, c) => P('M15 36h18l2 5H13z', c) + C(24, 22, 12.4, a, NS + ' fill-opacity=".3"') + C(24, 22, 11, a) + P('M18.4 22.4C19.6 17 26.4 15.6 29 20 30.6 24 26.6 27 24 25 22.2 23.6 23.6 21 25.6 21.8', 'none', ST(b, 1.4)) + E(19.4, 16.6, 2.6, 1.4, '#fff', NS + ' fill-opacity=".55"'),
  watch: (a, b) => P('M20 8h8l1 6h-10zM20 40h8l1-6h-10z', a) + C(24, 24, 11.6, a) + C(24, 24, 9, b) + P('M24 17.4V24L28.6 26.6', 'none', ST(INK, 1.4)) + Array.from({ length: 12 }, (_, i) => { const t = i * Math.PI / 6; return C(n1(24 + 7.4 * Math.cos(t)), n1(24 + 7.4 * Math.sin(t)), 0.5, INK, NS); }).join('') + C(24, 24, 1.2, a)
};
const renderArt = (draw, cs) => badgeOpen(cs[0]) + (ART_DRAW[draw] ? ART_DRAW[draw](cs[1], cs[2], cs[3]) : '') + badgeClose();

// ---------------------------------------------------------------- Catalogue
const parseColors = s => String(s).split(',').map(colorOfTok);
const BADGES = Object.freeze([
  ...HEADS.trim().split('\n').map(line => { const [key, label, cat, spec, colors, tags] = line.split('|'); const cs = parseColors(colors); return Object.freeze({ key, label, cat, kind: 'hero', spec, colors: Object.freeze({ bg: cs[0], a: cs[1], b: cs[2], e: cs[3], s: cs[4], r: cs[5], m: cs[6] || '' }), accent: cs[2] || cs[1], tags: tags || '' }); }),
  ...ARTS.trim().split('\n').map(line => { const [key, label, draw, colors, tags] = line.split('|'); const cs = parseColors(colors); return Object.freeze({ key, label, cat: 'artefacts', kind: 'artifact', draw, cs: Object.freeze(cs), accent: cs[1], tags: tags || '' }); })
]);
const ALL = Object.freeze([...ICONS.map(i => Object.freeze({ key: i.key, label: i.label, hint: i.hint, cat: 'classiques', kind: 'glyph', tags: '' })), ...BADGES]);
const BY = new Map(ALL.map(x => [x.key, x]));
const KEYS = Object.freeze(ALL.map(x => x.key));
const DEFAULT = 'heart';
const sanitize = v => typeof v === 'string' && BY.has(v) ? v : DEFAULT;
const get = k => BY.get(sanitize(k));
const labelOf = k => get(k).label;
const catOf = k => get(k).cat;
const catLabel = c => (CATEGORIES.find(x => x.key === c) || { label: '' }).label;
const hintOf = k => { const x = get(k); return x.hint || catLabel(x.cat); };
const colorOf = k => { const x = get(k); return x.kind === 'glyph' ? '' : x.accent; };
const byCat = c => ALL.filter(x => x.cat === c);

const CACHE = new Map();
// SVG complet d'un badge (null pour un glyphe classique, dessiné par l'interface)
const svgOf = k => {
  const x = BY.get(k);
  if (!x || x.kind === 'glyph') return null;
  if (!CACHE.has(k)) CACHE.set(k, x.kind === 'hero' ? renderHead(x.spec, x.colors) : renderArt(x.draw, x.cs));
  return CACHE.get(k);
};

// Recherche et suggestion : sur le nom, la catégorie et les tags (personnages que l'utilisateur pourrait taper)
const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const STOP = new Set(['man', 'the', 'of', 'de', 'la', 'le', 'les', 'des', 'du', 'mr', 'dr', 'x', 'el', 'et', 'l', 'd', 'un', 'une']);
const words = t => norm(t).split(' ').filter(w => w && !STOP.has(w));
const score = (x, q) => {
  const ws = words(q); if (!ws.length) return 0;
  const tags = norm(x.tags), tw = tags ? tags.split(' ') : [], name = norm(x.label), nw = name.split(' ');
  let s = 0;
  ws.forEach(w => { if (tw.includes(w)) s += 1; else if (w.length >= 4 && tw.some(t => t.startsWith(w))) s += 0.6; if (nw.includes(w)) s += 1.2; else if (w.length >= 3 && name.includes(w)) s += 0.5; });
  const nq = norm(q);
  if (nq.length >= 4 && (' ' + tags + ' ').includes(' ' + nq + ' ')) s += 2;
  if (tw.length && ws[0] === tw[0]) s += 0.5;
  return s;
};
const search = (q, limit) => {
  if (!norm(q)) return [];
  return ALL.map((x, i) => ({ x, i, s: score(x, q) })).filter(r => r.s > 0).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, limit || 60).map(r => r.x);
};

// Mots du personnage favori -> glyphe classique (repli)
const HINTS = [
  [/panth|wakanda|t.?challa|shuri|tigr|catwoman|wolverine|logan|griff/, 'claws'],
  [/flash|shazam|thor|storm|tonnerre|eclair|static|black lightning|captain marvel/, 'bolt'],
  [/spider|araign|miles|gwen|venom|tisse/, 'web'],
  [/thor|mjolnir|marteau|beta ray|steel/, 'hammer'],
  [/bat|nightwing|robin|chauve|dark knight|moon knight/, 'wings'],
  [/torch|torche|phoenix|phenix|ghost rider|firestorm|feu|flamme|human torch|johnny storm|starfire/, 'flame'],
  [/silver surfer|surfer|galactus|nova|cosmi|star.?lord|guardians|gardiens|captain marvel|carol|thanos/, 'cosmic'],
  [/lantern|lanterne|green lantern|hal jordan|anneau|ring/, 'ring'],
  [/daredevil|deadpool|zorro|masque|mask|rorschach|v pour|kick.?ass/, 'mask'],
  [/captain america|cap |steve rogers|wonder woman|diana|bouclier|shield|superman|clark/, 'shield'],
  [/punisher|ghost|crane|skull|red hood|lobo|venom|carnage/, 'skull']
];
// Suggestion depuis le personnage favori : d'abord un badge dessiné, sinon un glyphe classique ; jamais imposée.
const suggestFor = favorite => {
  const f = norm(favorite);
  if (!f) return null;
  const best = BADGES.map((x, i) => ({ x, i, s: score(x, favorite) })).filter(r => r.s >= 1).sort((a, b) => b.s - a.s || a.i - b.i)[0];
  if (best) return best.x.key;
  for (const [re, k] of HINTS) if (re.test(f)) return k;
  return null;
};

module.exports = { ICONS, CATEGORIES, ALL, KEYS, DEFAULT, sanitize, labelOf, catOf, catLabel, hintOf, colorOf, byCat, svgOf, search, suggestFor };
