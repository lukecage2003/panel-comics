'use strict';
// Artefacts Panel (D-63) : badges à débloquer, inspirés d'objets célèbres des univers Marvel et DC
// (noms cités à titre de référence ; marques de leurs ayants droit).
// D-75 : objectifs pensés pour une dizaine d'années de lecture et de collection (personne ne finit le Gant en quelques mois) ;
//  les objets Marvel sont illustrés par leur vraie image de comic (Marvel Database, via l'atlas des cosmologies : img, imgSrc).
//  - Chaque artefact se débloque sur une mesure réelle de l'activité locale (collection, lecture, avis, stories…).
//  - Les six Gemmes de l'Infini se combinent : le Gant de l'Infini exige les six.
//  - Module pur : rien n'est stocké ni envoyé ; aucun déblocage n'est inventé.

const RARITIES = Object.freeze({
  commun: { label: 'Commun', order: 1 },
  rare: { label: 'Rare', order: 2 },
  epique: { label: 'Épique', order: 3 },
  legendaire: { label: 'Légendaire', order: 4 },
  mythique: { label: 'Mythique', order: 5 }
});

// Mesures disponibles (toutes calculées sur l'appareil)
const METRICS = Object.freeze({
  owned: 'numéros possédés', read: 'numéros lus', reread: 'relectures', rated: 'notes données', reviewed: 'avis écrits',
  runs: 'runs complets', keys: 'key issues possédés', planches: 'planches préparées', stories: 'stories de lecture',
  publishers: 'éditeurs différents', characters: 'personnages différents', value: 'valeur estimée (unités monétaires)'
});

// glyph : symbole court dessiné par Panel (pas de logo) ; hue : teinte de la médaille
const ARTEFACTS = Object.freeze([
  { id: 'batarang', name: 'Batarang', universe: 'dc', rarity: 'commun', metric: 'owned', goal: 1, glyph: '◆', hue: 220, lore: 'Le premier outil d\'un justicier : votre premier comic.' },
  { id: 'web_shooter', name: 'Lance-toile', universe: 'marvel', rarity: 'commun', metric: 'read', goal: 10, glyph: '✳', hue: 0, lore: 'Dix numéros lus : vous commencez à tisser votre toile.' },
  { id: 'daily_planet', name: 'Une du Daily Planet', universe: 'dc', rarity: 'commun', metric: 'stories', goal: 1, glyph: '▤', hue: 200, lore: 'Votre première story de lecture.' },
  { id: 'camera_parker', name: 'Appareil de Peter Parker', universe: 'marvel', rarity: 'rare', metric: 'planches', goal: 25, glyph: '◉', hue: 10, lore: 'Vingt-cinq planches préparées, dignes de la une du Bugle.' },
  { id: 'shield_cap', name: 'Bouclier de Captain America', universe: 'marvel', rarity: 'rare', metric: 'runs', goal: 3, glyph: '✪', hue: 215, lore: 'Trois runs complets : la constance d\'un super-soldat.' },
  { id: 'lasso', name: 'Lasso de Vérité', universe: 'dc', rarity: 'rare', metric: 'reviewed', goal: 25, glyph: '➰', hue: 45, lore: 'Vingt-cinq avis sincères.' },
  { id: 'lantern_ring', name: 'Anneau de Green Lantern', universe: 'dc', rarity: 'rare', metric: 'read', goal: 1000, glyph: '◎', hue: 130, lore: 'Mille numéros lus, avec la volonté d\'un Lantern.' },
  { id: 'helmet_fate', name: 'Casque de Nabu', universe: 'dc', rarity: 'rare', metric: 'rated', goal: 250, glyph: '☥', hue: 50, lore: 'Deux cent cinquante notes : un jugement éclairé.' },
  { id: 'kryptonite', name: 'Kryptonite', universe: 'dc', rarity: 'epique', metric: 'keys', goal: 50, glyph: '⬢', hue: 140, lore: 'Cinquante key issues : des pièces rares et redoutées.' },
  { id: 'mother_box', name: 'Boîte-Mère', universe: 'dc', rarity: 'epique', metric: 'publishers', goal: 12, glyph: '▣', hue: 190, lore: 'Douze éditeurs différents : vous voyagez entre les mondes.' },
  { id: 'cerebro', name: 'Cerebro', universe: 'marvel', rarity: 'epique', metric: 'characters', goal: 60, glyph: '⌬', hue: 265, lore: 'Soixante personnages différents repérés dans votre collection.' },
  { id: 'eye_agamotto', name: 'Œil d\'Agamotto', universe: 'marvel', rarity: 'epique', metric: 'reread', goal: 150, glyph: '◈', hue: 95, lore: 'Cent cinquante relectures : maître du temps qui repasse.', img: 'https://static.wikia.nocookie.net/marveldatabase/images/e/e4/Eye_of_Agamotto_%28Knowledge%29_from_Guidebook_to_the_Marvel_Cinematic_Universe_-_Marvel%27s_Doctor_Strange_Vol_1_1_01.jpg/revision/latest?cb=20190604223449', imgSrc: 'o_eye' },
  { id: 'nth_metal', name: 'Métal Nth', universe: 'dc', rarity: 'epique', metric: 'runs', goal: 25, glyph: '⬡', hue: 30, lore: 'Vingt-cinq runs complets.' },
  { id: 'mjolnir', name: 'Mjolnir', universe: 'marvel', rarity: 'legendaire', metric: 'read', goal: 5000, glyph: 'ᛉ', hue: 205, lore: 'Cinq mille numéros lus : vous êtes digne.', img: 'https://static.wikia.nocookie.net/marveldatabase/images/9/9a/Immortal_Thor_Vol_1_4_Textless.jpg/revision/latest/scale-to-width-down/592?cb=20250614001946', imgSrc: 'o_mjolnir' },
  { id: 'vibranium', name: 'Lingot de vibranium', universe: 'marvel', rarity: 'legendaire', metric: 'value', goal: 25000, glyph: '⟁', hue: 280, lore: 'Une collection estimée à vingt-cinq mille unités ou plus.' },
  { id: 'cosmic_cube', name: 'Cube cosmique', universe: 'marvel', rarity: 'legendaire', metric: 'owned', goal: 5000, glyph: '⬛', hue: 195, lore: 'Cinq mille numéros possédés.', img: 'https://static.wikia.nocookie.net/marveldatabase/images/1/13/Avengers_Standoff_Welcome_to_Pleasant_Hill_Vol_1_1_Textless.jpg/revision/latest/scale-to-width-down/599?cb=20151117195132', imgSrc: 'x_cube' },
  { id: 'nullifier', name: 'Ultimate Nullifier', universe: 'marvel', rarity: 'mythique', metric: 'reviewed', goal: 1000, glyph: '⌖', hue: 340, lore: 'Mille avis écrits : une arme critique absolue.', img: 'https://static.wikia.nocookie.net/marveldatabase/images/6/68/Ultimate_Nullifier_%28Weapon%29_from_All-New_Official_Handbook_of_the_Marvel_Universe_A_to_Z_Vol_1_11_001.jpg/revision/latest/scale-to-width-down/568?cb=20180712161246', imgSrc: 'x_nullifier' },
  // Gemmes de l'Infini
  { id: 'gem_space', name: 'Gemme de l\'Espace', universe: 'marvel', rarity: 'epique', metric: 'publishers', goal: 15, glyph: '◆', hue: 215, gem: true, lore: 'Quinze éditeurs différents.', img: 'https://static.wikia.nocookie.net/marveldatabase/images/0/05/Space_Gem_from_Marvel_Legacy_Vol_1_1_001.jpg/revision/latest?cb=20171118004348', imgSrc: 'x_sspace' },
  { id: 'gem_mind', name: 'Gemme de l\'Esprit', universe: 'marvel', rarity: 'epique', metric: 'reviewed', goal: 300, glyph: '◆', hue: 50, gem: true, lore: 'Trois cents avis écrits.', img: 'https://static.wikia.nocookie.net/marveldatabase/images/c/c5/Infinity_Countdown_Vol_1_4_Turk_Holds_Infinity_Unknown_Comics_Exclusive_Virgin_Variant.jpg/revision/latest/scale-to-width-down/600?cb=20180530173556', imgSrc: 'x_smind' },
  { id: 'gem_reality', name: 'Gemme de la Réalité', universe: 'marvel', rarity: 'epique', metric: 'read', goal: 2500, glyph: '◆', hue: 0, gem: true, lore: 'Deux mille cinq cents numéros lus.', img: 'https://static.wikia.nocookie.net/marveldatabase/images/9/9d/Captain_Marvel_Vol_10_128_Textless.jpg/revision/latest/scale-to-width-down/593?cb=20171017171558', imgSrc: 'x_sreal' },
  { id: 'gem_power', name: 'Gemme du Pouvoir', universe: 'marvel', rarity: 'epique', metric: 'owned', goal: 2500, glyph: '◆', hue: 285, gem: true, lore: 'Deux mille cinq cents numéros possédés.', img: 'https://static.wikia.nocookie.net/marveldatabase/images/a/a0/Power_Stone_from_Immortal_Thor_Annual_Vol_1_1_001.jpg/revision/latest?cb=20240723142424', imgSrc: 'x_spow' },
  { id: 'gem_time', name: 'Gemme du Temps', universe: 'marvel', rarity: 'epique', metric: 'reread', goal: 200, glyph: '◆', hue: 130, gem: true, lore: 'Deux cents relectures.', img: 'https://static.wikia.nocookie.net/marveldatabase/images/8/8b/Time_Gem_from_Doctor_Strange_Vol_5_3_001.jpg/revision/latest?cb=20180719031113', imgSrc: 'x_stime' },
  { id: 'gem_soul', name: 'Gemme de l\'Âme', universe: 'marvel', rarity: 'epique', metric: 'stories', goal: 365, glyph: '◆', hue: 30, gem: true, lore: 'Trois cent soixante-cinq stories de lecture : une par jour pendant un an.', img: 'https://static.wikia.nocookie.net/marveldatabase/images/f/f4/Soul_Gem_from_Infinity_Wars_Vol_1_6_001.jpg/revision/latest?cb=20190203021316', imgSrc: 'x_ssoul' },
  { id: 'gauntlet', name: 'Gant de l\'Infini', universe: 'marvel', rarity: 'mythique', metric: 'gems', goal: 6, glyph: '✋', hue: 45, lore: 'Les six gemmes réunies.', img: 'https://static.wikia.nocookie.net/marveldatabase/images/e/ec/Infinity_Gauntlet_%28Item%29_from_New_Avengers_Vol_3_3_001.jpg/revision/latest/scale-to-width-down/559?cb=20151013053043', imgSrc: 'x_gauntlet' }
].map(a => Object.freeze(a)));

const num = v => Math.max(0, Number(v) || 0);

// activity : mesures de METRICS. Renvoie chaque artefact avec sa progression, puis le résumé.
const computeArtefacts = (activity = {}) => {
  const base = ARTEFACTS.filter(a => a.metric !== 'gems').map(a => {
    const have = num(activity[a.metric]);
    return { ...a, have, unlocked: have >= a.goal, progress: Math.min(1, have / a.goal), rarityLabel: RARITIES[a.rarity].label };
  });
  const gems = base.filter(a => a.gem && a.unlocked).length;
  const out = ARTEFACTS.map(a => a.metric === 'gems'
    ? { ...a, have: gems, unlocked: gems >= a.goal, progress: Math.min(1, gems / a.goal), rarityLabel: RARITIES[a.rarity].label }
    : base.find(b => b.id === a.id));
  const unlocked = out.filter(a => a.unlocked);
  // Prochain artefact : le plus avancé parmi ceux qui restent
  const next = out.filter(a => !a.unlocked).sort((x, y) => y.progress - x.progress || RARITIES[x.rarity].order - RARITIES[y.rarity].order)[0] || null;
  return { list: out, unlocked: unlocked.length, total: out.length, gems, next };
};

module.exports = { RARITIES, METRICS, ARTEFACTS, computeArtefacts };
