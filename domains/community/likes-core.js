'use strict';
// J'aime personnalisé (D-96) : chacun choisit la forme de son « J'aime ». Les formes sont des dessins originaux de Panel
// (griffes, éclair, toile, marteau…), jamais un logo ni un personnage déposé : aucune marque de Marvel, DC ou d'un autre éditeur.
// Une suggestion peut venir du personnage favori écrit dans le profil ; le choix reste toujours celui de l'utilisateur.

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
const KEYS = ICONS.map(i => i.key);
const DEFAULT = 'heart';
const sanitize = v => KEYS.includes(v) ? v : DEFAULT;
const labelOf = k => (ICONS.find(i => i.key === sanitize(k)) || ICONS[0]).label;

// Mots du personnage favori (texte libre de l'utilisateur) -> forme suggérée. Simple correspondance de mots, rien n'est envoyé.
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
const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const suggestFor = favorite => {
  const f = norm(favorite);
  if (!f.trim()) return null;
  for (const [re, k] of HINTS) if (re.test(f)) return k;
  return null;
};

module.exports = { ICONS, KEYS, DEFAULT, sanitize, labelOf, suggestFor };
