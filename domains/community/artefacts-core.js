'use strict';
// Artefacts Panel (D-63) : badges à débloquer, inspirés d'objets célèbres des univers Marvel et DC
// (noms cités à titre de référence ; marques de leurs ayants droit ; aucun visuel officiel utilisé).
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
  { id: 'camera_parker', name: 'Appareil de Peter Parker', universe: 'marvel', rarity: 'rare', metric: 'planches', goal: 10, glyph: '◉', hue: 10, lore: 'Dix planches préparées, dignes de la une du Bugle.' },
  { id: 'shield_cap', name: 'Bouclier de Captain America', universe: 'marvel', rarity: 'rare', metric: 'runs', goal: 1, glyph: '✪', hue: 215, lore: 'Un run complet : la constance d\'un super-soldat.' },
  { id: 'lasso', name: 'Lasso de Vérité', universe: 'dc', rarity: 'rare', metric: 'reviewed', goal: 10, glyph: '➰', hue: 45, lore: 'Dix avis sincères.' },
  { id: 'lantern_ring', name: 'Anneau de Green Lantern', universe: 'dc', rarity: 'rare', metric: 'read', goal: 100, glyph: '◎', hue: 130, lore: 'Cent numéros lus, avec la volonté d\'un Lantern.' },
  { id: 'helmet_fate', name: 'Casque de Nabu', universe: 'dc', rarity: 'rare', metric: 'rated', goal: 50, glyph: '☥', hue: 50, lore: 'Cinquante notes : un jugement éclairé.' },
  { id: 'kryptonite', name: 'Kryptonite', universe: 'dc', rarity: 'epique', metric: 'keys', goal: 10, glyph: '⬢', hue: 140, lore: 'Dix key issues : des pièces rares et redoutées.' },
  { id: 'mother_box', name: 'Boîte-Mère', universe: 'dc', rarity: 'epique', metric: 'publishers', goal: 6, glyph: '▣', hue: 190, lore: 'Six éditeurs différents : vous voyagez entre les mondes.' },
  { id: 'cerebro', name: 'Cerebro', universe: 'marvel', rarity: 'epique', metric: 'characters', goal: 15, glyph: '⌬', hue: 265, lore: 'Quinze personnages différents repérés dans votre collection.' },
  { id: 'eye_agamotto', name: 'Œil d\'Agamotto', universe: 'marvel', rarity: 'epique', metric: 'reread', goal: 25, glyph: '◈', hue: 95, lore: 'Vingt-cinq relectures : maître du temps qui repasse.' },
  { id: 'nth_metal', name: 'Métal Nth', universe: 'dc', rarity: 'epique', metric: 'runs', goal: 5, glyph: '⬡', hue: 30, lore: 'Cinq runs complets.' },
  { id: 'mjolnir', name: 'Mjolnir', universe: 'marvel', rarity: 'legendaire', metric: 'read', goal: 500, glyph: 'ᛉ', hue: 205, lore: 'Cinq cents numéros lus : vous êtes digne.' },
  { id: 'vibranium', name: 'Lingot de vibranium', universe: 'marvel', rarity: 'legendaire', metric: 'value', goal: 1000, glyph: '⟁', hue: 280, lore: 'Une collection estimée à mille unités ou plus.' },
  { id: 'cosmic_cube', name: 'Cube cosmique', universe: 'marvel', rarity: 'legendaire', metric: 'owned', goal: 1000, glyph: '⬛', hue: 195, lore: 'Mille numéros possédés.' },
  { id: 'nullifier', name: 'Ultimate Nullifier', universe: 'marvel', rarity: 'mythique', metric: 'reviewed', goal: 100, glyph: '⌖', hue: 340, lore: 'Cent avis écrits : une arme critique absolue.' },
  // Gemmes de l'Infini
  { id: 'gem_space', name: 'Gemme de l\'Espace', universe: 'marvel', rarity: 'epique', metric: 'publishers', goal: 4, glyph: '◆', hue: 215, gem: true, lore: 'Quatre éditeurs différents.' },
  { id: 'gem_mind', name: 'Gemme de l\'Esprit', universe: 'marvel', rarity: 'epique', metric: 'reviewed', goal: 25, glyph: '◆', hue: 50, gem: true, lore: 'Vingt-cinq avis écrits.' },
  { id: 'gem_reality', name: 'Gemme de la Réalité', universe: 'marvel', rarity: 'epique', metric: 'read', goal: 200, glyph: '◆', hue: 0, gem: true, lore: 'Deux cents numéros lus.' },
  { id: 'gem_power', name: 'Gemme du Pouvoir', universe: 'marvel', rarity: 'epique', metric: 'owned', goal: 300, glyph: '◆', hue: 285, gem: true, lore: 'Trois cents numéros possédés.' },
  { id: 'gem_time', name: 'Gemme du Temps', universe: 'marvel', rarity: 'epique', metric: 'reread', goal: 10, glyph: '◆', hue: 130, gem: true, lore: 'Dix relectures.' },
  { id: 'gem_soul', name: 'Gemme de l\'Âme', universe: 'marvel', rarity: 'epique', metric: 'stories', goal: 20, glyph: '◆', hue: 30, gem: true, lore: 'Vingt stories de lecture.' },
  { id: 'gauntlet', name: 'Gant de l\'Infini', universe: 'marvel', rarity: 'mythique', metric: 'gems', goal: 6, glyph: '✋', hue: 45, lore: 'Les six gemmes réunies.' }
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
