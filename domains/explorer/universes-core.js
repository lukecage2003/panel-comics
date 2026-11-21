'use strict';
// Univers des comics (D-105) : catalogue éditorial rédigé pour Panel, sans image ni texte repris d'une source.
// Chaque univers : clé, nom, éditeur, année de naissance, famille, phrase de présentation, recherche associée et personnages
// ou séries phares (de simples noms, utilisés comme portes vers la recherche). Aucune donnée personnelle ; aucun accès au réseau.
// Le classement des résultats de recherche en ligne (pertinence × notoriété) et le repérage des images « vides » des sources
// sont aussi ici, pour être testés hors de l'interface.

const FAMILIES = Object.freeze({ marvel: 'Marvel', dc: 'DC', image: 'Image et Skybound', indie: 'Indépendants', licence: 'Licences' });

const U = (key, name, publisher, since, family, tagline, q, icons) => Object.freeze({ key, name, publisher, since, family, tagline, q, icons: Object.freeze(icons) });
const UNIVERSES = Object.freeze([
  U('marvel-616', 'Marvel', 'Marvel', 1961, 'marvel', 'L\'univers principal de Marvel, né avec les Fantastic Four.', 'Marvel', ['Spider-Man', 'X-Men', 'Avengers', 'Fantastic Four']),
  U('ultimate', 'Ultimate Universe', 'Marvel', 2000, 'marvel', 'Les héros Marvel réinventés pour un nouveau départ, relancé en 2023.', 'Ultimate', ['Ultimate Spider-Man', 'Ultimate X-Men', 'The Ultimates']),
  U('marvel-2099', 'Marvel 2099', 'Marvel', 1992, 'marvel', 'Le futur de Marvel, de Spider-Man 2099 aux héros de la fin du siècle.', '2099', ['Spider-Man 2099', 'Doom 2099']),
  U('star-wars', 'Star Wars', 'Marvel', 2015, 'licence', 'La galaxie lointaine, très lointaine, en comics chez Marvel depuis 2015.', 'Star Wars', ['Darth Vader', 'Star Wars', 'Doctor Aphra']),
  U('dc', 'DC', 'DC Comics', 1938, 'dc', 'Superman, Batman, Wonder Woman et la Justice League.', 'DC Comics', ['Superman', 'Batman', 'Wonder Woman', 'Justice League']),
  U('absolute', 'Absolute Universe', 'DC Comics', 2024, 'dc', 'Les héros DC privés de leurs appuis, dans un monde plus hostile.', 'Absolute', ['Absolute Batman', 'Absolute Superman', 'Absolute Wonder Woman']),
  U('black-label', 'DC Black Label', 'DC Comics', 2018, 'dc', 'Des récits pour lecteurs adultes, hors de la continuité.', 'Black Label', ['Batman: Damned', 'Superman: Space Age']),
  U('vertigo', 'Vertigo', 'DC Comics', 1993, 'dc', 'Le label adulte de DC : fantastique, horreur et polar.', 'Vertigo', ['Sandman', 'Hellblazer', 'Preacher', 'Y: The Last Man']),
  U('wildstorm', 'WildStorm', 'DC Comics', 1992, 'dc', 'L\'univers lancé par Jim Lee chez Image, puis repris par DC.', 'WildStorm', ['WildC.A.T.s', 'The Authority', 'Stormwatch']),
  U('milestone', 'Milestone', 'DC Comics', 1993, 'dc', 'Fondé par Dwayne McDuffie, Denys Cowan, Michael Davis et Derek T. Dingle.', 'Milestone', ['Static', 'Icon', 'Hardware', 'Blood Syndicate']),
  U('image', 'Image Comics', 'Image Comics', 1992, 'image', 'Des créateurs propriétaires de leurs œuvres.', 'Image Comics', ['Saga', 'Monstress', 'Paper Girls']),
  U('spawn', 'Spawn', 'Image Comics', 1992, 'image', 'Le héros revenu des enfers de Todd McFarlane et ses séries dérivées.', 'Spawn', ['Spawn', 'King Spawn', 'Gunslinger Spawn']),
  U('walking-dead', 'The Walking Dead', 'Image Comics', 2003, 'image', 'L\'apocalypse zombie de Robert Kirkman, Tony Moore et Charlie Adlard.', 'The Walking Dead', ['The Walking Dead', 'Negan', 'Clementine']),
  U('invincible', 'Invincible', 'Image Comics', 2003, 'image', 'Le super-héros de Robert Kirkman, Cory Walker et Ryan Ottley.', 'Invincible', ['Invincible', 'Battle Beast', 'Atom Eve']),
  U('energon', 'Energon Universe', 'Image Comics', 2023, 'image', 'Transformers et G.I. Joe réunis dans un même univers, chez Skybound.', 'Energon Universe', ['Transformers', 'G.I. Joe', 'Void Rivals', 'Duke']),
  U('massive', 'Massive-Verse', 'Image Comics', 2021, 'image', 'Radiant Black et les héros qui partagent son monde.', 'Massive-Verse', ['Radiant Black', 'Rogue Sun', 'Inferno Girl Red']),
  U('top-cow', 'Top Cow', 'Image Comics', 1992, 'image', 'Le studio de Marc Silvestri : magie, armes anciennes et artefacts.', 'Top Cow', ['Witchblade', 'The Darkness']),
  U('hellboy', 'Hellboy et le Mignolaverse', 'Dark Horse', 1994, 'indie', 'Hellboy, le B.P.R.D. et l\'occulte de Mike Mignola.', 'Hellboy', ['Hellboy', 'B.P.R.D.', 'Abe Sapien']),
  U('dark-horse', 'Dark Horse', 'Dark Horse', 1986, 'indie', 'Éditeur indépendant de créateurs et de grandes licences.', 'Dark Horse', ['Sin City', 'The Umbrella Academy', 'Black Hammer']),
  U('valiant', 'Valiant', 'Valiant', 1989, 'indie', 'Un univers partagé de super-héros, relancé en 2012.', 'Valiant', ['X-O Manowar', 'Bloodshot', 'Ninjak']),
  U('boom', 'BOOM! Studios', 'BOOM! Studios', 2005, 'indie', 'Horreur, fantastique et grandes séries de créateurs.', 'BOOM! Studios', ['Something is Killing the Children', 'Once & Future']),
  U('tmnt', 'Teenage Mutant Ninja Turtles', 'IDW Publishing', 1984, 'licence', 'Les Tortues de Kevin Eastman et Peter Laird, chez IDW depuis 2011.', 'Teenage Mutant Ninja Turtles', ['Leonardo', 'Raphael', 'Donatello', 'Michelangelo']),
  U('idw', 'IDW Publishing', 'IDW Publishing', 1999, 'indie', 'Licences et séries de créateurs, de Star Trek à Locke & Key.', 'IDW Publishing', ['Locke & Key', 'Star Trek', 'Sonic the Hedgehog']),
  U('dynamite', 'Dynamite', 'Dynamite', 2004, 'indie', 'Héros classiques et récits musclés.', 'Dynamite', ['The Boys', 'Vampirella', 'Red Sonja']),
  U('archie', 'Archie', 'Archie Comics', 1941, 'indie', 'Riverdale, Archie, Betty, Veronica et Jughead.', 'Archie', ['Archie', 'Jughead', 'Sabrina'])
]);

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Univers d'une famille, dans l'ordre du catalogue ; « all » ou vide : tous
const byFamily = fam => !fam || fam === 'all' ? UNIVERSES.slice() : UNIVERSES.filter(u => u.family === fam);
// Univers dont le nom, l'éditeur ou un personnage phare correspond à la recherche
const find = q => { const n = norm(q); if (n.length < 2) return []; return UNIVERSES.filter(u => [u.name, u.publisher, u.q].concat(u.icons).some(x => norm(x).includes(n))); };
// Univers liés à un nom (personnage, série) : pour proposer « Son univers » sur une fiche
const ofName = name => { const n = norm(name); if (n.length < 3) return []; return UNIVERSES.filter(u => u.icons.some(x => { const k = norm(x); return k === n || (' ' + n + ' ').includes(' ' + k + ' '); })); };
// Teinte stable par univers (cartes sans image) : couleur de la famille (Marvel rouge, DC bleu…), légèrement variée
const FAMILY_HUE = Object.freeze({ marvel: 356, dc: 214, image: 168, indie: 28, licence: 268 });
const hue = key => { const u = UNIVERSES.find(x => x.key === key); const v = [...String(key)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 997, 11) % 30 - 15; return ((u ? FAMILY_HUE[u.family] : 0) + v + 360) % 360; };

// ── Recherche en ligne ─────────────────────────────────────────────────────────
// Images génériques des sources (« pas d'image ») : à remplacer par l'emblème de Panel, jamais présentées comme un portrait
const isPlaceholderImage = url => !url || /(^|\/)[^/]*(blank|img_broken|image_not_found|no[-_]?image|default[-_]avatar)[^/]*\.(png|jpe?g|gif|webp)(\?|$)/i.test(String(url));

// Pertinence du nom par rapport à la recherche : exact > début > mot entier > contenu
const relevance = (name, q) => {
  const n = norm(name), k = norm(q);
  if (!n || !k) return 0;
  if (n === k) return 3;
  if (n.startsWith(k + ' ') || n.startsWith(k)) return 2.3;
  if ((' ' + n + ' ').includes(' ' + k + ' ')) return 1.7;
  if (n.includes(k)) return 1.2;
  const words = k.split(' ');
  return words.every(w => n.includes(w)) ? 1 : 0.4;
};
const MAJOR = new Set(['marvel', 'dc comics', 'image', 'image comics', 'dark horse comics', 'dark horse', 'idw publishing', 'boom studios', 'dynamite entertainment', 'valiant', 'skybound']);
// Score : pertinence × notoriété (apparitions ou nombre de numéros, en logarithme), léger bonus aux grands éditeurs et aux images réelles
const score = (r, q) => {
  const rel = relevance(r.name || (r.volume && r.volume.name) || '', q);
  const pop = Number(r.count_of_issue_appearances || r.count_of_issues || 0);
  const pub = norm(r.publisher && r.publisher.name);
  return rel * (1 + Math.log10(1 + Math.max(0, pop))) * (MAJOR.has(pub) ? 1.25 : 1) * (isPlaceholderImage(r.image && (r.image.small_url || r.image.medium_url)) ? 0.85 : 1);
};
// Tri stable par score décroissant (l'ordre d'origine départage)
const rank = (list, q) => (list || []).map((r, i) => ({ r, i, s: score(r, q) })).sort((a, b) => b.s - a.s || a.i - b.i).map(x => x.r);

module.exports = { FAMILIES, UNIVERSES, byFamily, find, ofName, hue, isPlaceholderImage, relevance, score, rank };
