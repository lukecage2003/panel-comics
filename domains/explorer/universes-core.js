'use strict';
// Univers des comics (D-105, précisé en D-106) : catalogue éditorial rédigé pour Panel, sans image ni texte repris d'une source.
// Chaque univers : clé, nom, éditeur, périodes de publication [début, fin] (fin null = en cours, 0 = fin non établie),
// famille, présentation, créateurs ou fondateurs, recherche associée, personnages ou séries phares (de simples noms) et une
// source vérifiable (dates et fondateurs vérifiés sur cette source le 21/11/2026). Aucune donnée personnelle, aucun accès au réseau.
// Les univers ajoutés par l'utilisateur passent par validateCustom (source https obligatoire) et restent sur l'appareil.
// Le classement des résultats de recherche en ligne (pertinence × notoriété) et le repérage des images « vides » des sources
// sont aussi ici, pour être testés hors de l'interface.

const FAMILIES = Object.freeze({ marvel: 'Marvel', dc: 'DC', image: 'Image et Skybound', indie: 'Indépendants', licence: 'Licences' });
const W = t => 'https://en.wikipedia.org/wiki/' + t;

const U = (key, name, publisher, periods, family, tagline, founders, q, icons, source) =>
  Object.freeze({ key, name, publisher, periods: Object.freeze(periods.map(p => Object.freeze(p))), since: periods[0][0], family, tagline, founders: Object.freeze(founders), q, icons: Object.freeze(icons), source });
const UNIVERSES = Object.freeze([
  U('marvel-616', 'Marvel', 'Marvel', [[1961, null]], 'marvel', 'L\'univers principal de Marvel (Terre-616), né avec Fantastic Four #1 en 1961.', ['Stan Lee', 'Jack Kirby', 'Steve Ditko'], 'Marvel', ['Spider-Man', 'X-Men', 'Avengers', 'Fantastic Four'], W('Marvel_Universe')),
  U('ultimate-1610', 'Ultimate Marvel', 'Marvel', [[2000, 2015]], 'marvel', 'Le premier univers Ultimate (Terre-1610), de Ultimate Spider-Man en 2000 jusqu\'à Secret Wars en 2015.', ['Brian Michael Bendis', 'Mark Millar'], 'Ultimate', ['Ultimate Spider-Man', 'Ultimate X-Men', 'The Ultimates', 'Miles Morales'], W('Ultimate_Marvel')),
  U('ultimate-6160', 'Ultimate Universe (2023)', 'Marvel', [[2023, 2026]], 'marvel', 'Le second univers Ultimate (Terre-6160), d\'Ultimate Invasion en 2023 à sa conclusion en 2026.', ['Jonathan Hickman'], 'Ultimate', ['Ultimate Spider-Man', 'Ultimate X-Men', 'Ultimate Black Panther', 'The Ultimates'], W('Ultimate_Universe_(2023)')),
  U('marvel-2099', 'Marvel 2099', 'Marvel', [[1992, 1998]], 'marvel', 'Le futur de l\'univers Marvel : la gamme 2099, de Spider-Man 2099 en 1992 à Manifest Destiny en 1998.', ['Peter David', 'Rick Leonardi'], '2099', ['Spider-Man 2099', 'Doom 2099', 'X-Men 2099'], W('Marvel_2099')),
  U('star-wars', 'Star Wars', 'Marvel', [[1977, 1986], [1991, 2014], [2015, null]], 'licence', 'Chez Marvel dès 1977, chez Dark Horse de 1991 à 2014, de retour chez Marvel depuis 2015.', [], 'Star Wars', ['Darth Vader', 'Star Wars', 'Doctor Aphra'], W('Star_Wars_comics')),
  U('dc', 'DC', 'DC Comics', [[1938, null]], 'dc', 'L\'univers principal de DC, né avec Superman dans Action Comics #1 en 1938.', ['Jerry Siegel', 'Joe Shuster', 'Bob Kane', 'Bill Finger'], 'DC Comics', ['Superman', 'Batman', 'Wonder Woman', 'Justice League'], W('DC_Universe')),
  U('absolute', 'Absolute Universe', 'DC Comics', [[2024, null]], 'dc', 'Les héros DC réinventés dans un monde plus hostile, lancé en 2024 sous la direction de Scott Snyder.', ['Scott Snyder'], 'Absolute', ['Absolute Batman', 'Absolute Superman', 'Absolute Wonder Woman'], W('Absolute_Universe')),
  U('black-label', 'DC Black Label', 'DC Comics', [[2018, null]], 'dc', 'Des récits pour lecteurs adultes, hors de la continuité, depuis 2018.', [], 'Black Label', ['Batman: Damned', 'Superman: Space Age'], W('DC_Black_Label')),
  U('vertigo', 'Vertigo', 'DC Comics', [[1993, 2020], [2024, null]], 'dc', 'Le label adulte de DC créé par Karen Berger : arrêté en janvier 2020, relancé en 2024.', ['Karen Berger'], 'Vertigo', ['Sandman', 'Hellblazer', 'Preacher', 'Y: The Last Man'], W('Vertigo_Comics')),
  U('wildstorm', 'WildStorm', 'DC Comics', [[1992, 2010]], 'dc', 'Fondé par Jim Lee chez Image en 1992, label de DC de 1998 à sa fermeture en 2010.', ['Jim Lee'], 'WildStorm', ['WildC.A.T.s', 'The Authority', 'Stormwatch'], W('WildStorm')),
  U('milestone', 'Milestone', 'DC Comics', [[1993, 1997], [2021, null]], 'dc', 'Fondé en 1993 par cinq créateurs afro-américains pour mieux représenter les minorités ; relancé en 2021.', ['Dwayne McDuffie', 'Denys Cowan', 'Michael Davis', 'Derek T. Dingle', 'Christopher Priest'], 'Milestone', ['Static', 'Icon', 'Hardware', 'Blood Syndicate'], W('Milestone_Media')),
  U('image', 'Image Comics', 'Image Comics', [[1992, null]], 'image', 'Fondé en 1992 par des dessinateurs partis de Marvel, pour que les créateurs gardent leurs œuvres.', ['Todd McFarlane', 'Jim Lee', 'Rob Liefeld', 'Marc Silvestri', 'Erik Larsen', 'Jim Valentino', 'Whilce Portacio'], 'Image Comics', ['Saga', 'Monstress', 'Paper Girls'], W('Image_Comics')),
  U('spawn', 'Spawn', 'Image Comics', [[1992, null]], 'image', 'Le héros revenu des enfers de Todd McFarlane, apparu dans Spawn #1 en mai 1992.', ['Todd McFarlane'], 'Spawn', ['Spawn', 'King Spawn', 'Gunslinger Spawn'], W('Spawn_(character)')),
  U('walking-dead', 'The Walking Dead', 'Image Comics', [[2003, 2019]], 'image', 'L\'apocalypse zombie de Robert Kirkman : 193 numéros, de 2003 à 2019.', ['Robert Kirkman', 'Tony Moore', 'Charlie Adlard'], 'The Walking Dead', ['The Walking Dead', 'Negan', 'Clementine'], W('The_Walking_Dead_(comic_book)')),
  U('invincible', 'Invincible', 'Image Comics', [[2003, 2018]], 'image', 'Le fils d\'Omni-Man : 144 numéros, de janvier 2003 à février 2018.', ['Robert Kirkman', 'Cory Walker', 'Ryan Ottley'], 'Invincible', ['Invincible', 'Omni-Man', 'Atom Eve'], W('Invincible_(comics)')),
  U('energon', 'Energon Universe', 'Image Comics', [[2023, null]], 'image', 'Transformers et G.I. Joe réunis chez Skybound avec Hasbro, depuis Void Rivals en 2023.', ['Robert Kirkman'], 'Energon Universe', ['Transformers', 'G.I. Joe', 'Void Rivals', 'Duke'], W('Energon_Universe')),
  U('massive', 'Massive-Verse', 'Image Comics', [[2021, null]], 'image', 'L\'univers partagé de Kyle Higgins, ouvert par Radiant Black en février 2021.', ['Kyle Higgins', 'Marcelo Costa'], 'Massive-Verse', ['Radiant Black', 'Rogue Sun', 'Inferno Girl Red'], W('Massive-Verse')),
  U('top-cow', 'Top Cow', 'Image Comics', [[1992, null]], 'image', 'Le studio fondé par Marc Silvestri en 1992 : Witchblade, The Darkness, Cyberforce.', ['Marc Silvestri'], 'Top Cow', ['Witchblade', 'The Darkness', 'Cyberforce'], W('Top_Cow_Productions')),
  U('hellboy', 'Hellboy et le Mignolaverse', 'Dark Horse', [[1993, null]], 'indie', 'Hellboy, apparu en août 1993, le B.P.R.D. et l\'occulte de Mike Mignola.', ['Mike Mignola'], 'Hellboy', ['Hellboy', 'B.P.R.D.', 'Abe Sapien'], W('Hellboy')),
  U('black-hammer', 'Black Hammer', 'Dark Horse', [[2016, null]], 'indie', 'L\'univers de héros oubliés de Jeff Lemire et Dean Ormston.', ['Jeff Lemire', 'Dean Ormston'], 'Black Hammer', ['Black Hammer', 'Sherlock Frankenstein', 'Colonel Weird'], W('Black_Hammer_(comics)')),
  U('dark-horse', 'Dark Horse', 'Dark Horse', [[1986, null]], 'indie', 'Éditeur indépendant de créateurs et de grandes licences, fondé en 1986.', ['Mike Richardson'], 'Dark Horse', ['Sin City', 'The Umbrella Academy', 'Usagi Yojimbo'], W('Dark_Horse_Comics')),
  U('valiant', 'Valiant', 'Valiant', [[1989, null]], 'indie', 'Fondé en 1989 par Jim Shooter et Steven Massarsky ; vendu à Acclaim en 1994, relancé en 2012.', ['Jim Shooter', 'Steven Massarsky'], 'Valiant', ['X-O Manowar', 'Bloodshot', 'Ninjak'], W('Valiant_Comics')),
  U('youneek', 'YouNeek YouNiverse', 'YouNeek Studios', [[2015, null]], 'indie', 'L\'univers de Roye Okupe, nourri des mythologies d\'Afrique de l\'Ouest ; publié avec Dark Horse depuis 2021.', ['Roye Okupe'], 'YouNeek', ['E.X.O.', 'Iyanu', 'Malika'], W('Roye_Okupe')),
  U('impound', 'iMPOUND Comics', 'iMPOUND Comics', [[2020, null]], 'indie', 'Créé par Brent « Trayce » Sands à Sacramento, autour du justicier Anthony « Impound » Endsley.', ['Brent Sands'], 'Impound', ['Impound', 'Seraph'], 'https://www.revolt.tv/article/2021-08-24/47764/brent-sands-mission-for-impound-comics-is-for-black-youth-to-see-themselves-in-superheroes-more'),
  U('catalyst-prime', 'Catalyst Prime', 'Lion Forge', [[2017, 0]], 'indie', 'L\'univers de super-héros de Lion Forge, éditeur fondé en 2011 par David Steward II et Carl Reed.', ['David Steward II', 'Carl Reed'], 'Catalyst Prime', ['Catalyst Prime', 'Accell', 'Noble'], W('Lion_Forge_Comics')),
  U('boom', 'BOOM! Studios', 'BOOM! Studios', [[2005, null]], 'indie', 'Horreur, fantastique et grandes séries de créateurs, depuis 2005.', ['Ross Richie'], 'BOOM! Studios', ['Something is Killing the Children', 'Once & Future'], W('Boom!_Studios')),
  U('tmnt', 'Teenage Mutant Ninja Turtles', 'IDW Publishing', [[1984, null]], 'licence', 'Les Tortues de Kevin Eastman et Peter Laird, nées chez Mirage en 1984, chez IDW depuis 2011.', ['Kevin Eastman', 'Peter Laird'], 'Teenage Mutant Ninja Turtles', ['Leonardo', 'Raphael', 'Donatello', 'Michelangelo'], W('Teenage_Mutant_Ninja_Turtles')),
  U('idw', 'IDW Publishing', 'IDW Publishing', [[1999, null]], 'indie', 'Licences et séries de créateurs, de Star Trek à Locke & Key, depuis 1999.', [], 'IDW Publishing', ['Locke & Key', 'Star Trek', 'Sonic the Hedgehog'], W('IDW_Publishing')),
  U('dynamite', 'Dynamite', 'Dynamite', [[2004, null]], 'indie', 'Fondé en 2004 par Nick Barrucci : héros classiques, licences et The Boys.', ['Nick Barrucci'], 'Dynamite', ['The Boys', 'Vampirella', 'Red Sonja', 'Project Superpowers'], W('Dynamite_Entertainment')),
  U('archie', 'Archie', 'Archie Comics', [[1941, null]], 'indie', 'Riverdale et sa bande, apparus dans Pep Comics #22 en décembre 1941.', ['John L. Goldwater', 'Bob Montana', 'Vic Bloom'], 'Archie', ['Archie', 'Jughead', 'Sabrina'], W('Archie_Comics'))
]);

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

// Périodes lisibles : « depuis 1961 », « 2000-2015 », « 1993-2020, depuis 2024 », « lancé en 2017 »
const periodLabel = periods => (periods || []).map(([a, b]) => b === null ? 'depuis ' + a : b === 0 ? 'lancé en ' + a : a === b ? String(a) : a + '-' + b).join(', ');
const isActive = u => (u.periods || []).some(([, b]) => b === null);

// ── Univers ajoutés par l'utilisateur (sur l'appareil) ─────────────────────────
const CUSTOM_MAX = 60;
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
// Vérifie et normalise ; la source (lien https) est obligatoire : rien n'est présenté sans provenance
const validateCustom = (raw, now = new Date().getFullYear()) => {
  const r = raw || {}, errors = [];
  const name = clean(r.name, 80), publisher = clean(r.publisher, 80), tagline = clean(r.tagline, 200), source = clean(r.source, 400);
  const from = parseInt(r.from, 10), to = r.to === '' || r.to == null ? null : parseInt(r.to, 10);
  if (name.length < 2) errors.push('name');
  if (!(from >= 1890 && from <= now)) errors.push('from');
  if (to !== null && !(to >= from && to <= now)) errors.push('to');
  if (!/^https:\/\/[^\s/]+\.[^\s/]+\/\S*$/.test(source)) errors.push('source');
  const icons = (Array.isArray(r.icons) ? r.icons : String(r.icons || '').split(',')).map(x => clean(x, 60)).filter(Boolean).slice(0, 8);
  const founders = (Array.isArray(r.founders) ? r.founders : String(r.founders || '').split(',')).map(x => clean(x, 60)).filter(Boolean).slice(0, 8);
  if (errors.length) return { ok: false, errors };
  const key = 'user-' + (clean(r.key, 40).replace(/[^a-z0-9-]/g, '') || norm(name).replace(/ /g, '-').slice(0, 30) || 'univers');
  return { ok: true, value: { key, name, publisher, periods: [[from, to]], since: from, family: 'user', tagline, founders, q: name, icons, source, custom: true } };
};
const sanitizeCustomList = list => (Array.isArray(list) ? list : []).map(x => validateCustom(Object.assign({}, x, { from: x && x.periods ? x.periods[0][0] : x && x.from, to: x && x.periods ? x.periods[0][1] : x && x.to, key: x && x.key ? String(x.key).replace(/^user-/, '') : '' })))
  .filter(r => r.ok).map(r => r.value).filter((u, i, a) => a.findIndex(v => v.key === u.key) === i).slice(0, CUSTOM_MAX);

// Univers d'une famille, dans l'ordre du catalogue ; « all » ou vide : tous ; « user » : ceux de l'utilisateur
const byFamily = (fam, custom = []) => !fam || fam === 'all' ? UNIVERSES.concat(custom) : fam === 'user' ? custom.slice() : UNIVERSES.filter(u => u.family === fam);
const all = (custom = []) => UNIVERSES.concat(custom);
// Univers dont le nom, l'éditeur, un fondateur ou un personnage phare correspond à la recherche
const find = (q, custom = []) => { const n = norm(q); if (n.length < 2) return []; return all(custom).filter(u => [u.name, u.publisher, u.q].concat(u.icons, u.founders).some(x => norm(x).includes(n))); };
// Univers liés à un nom (personnage, série) : pour proposer « Son univers » sur une fiche
const ofName = (name, custom = []) => { const n = norm(name); if (n.length < 3) return []; return all(custom).filter(u => u.icons.some(x => { const k = norm(x); return k === n || (' ' + n + ' ').includes(' ' + k + ' '); })); };
// Univers créés ou cofondés par une personne (fiche créateur)
const ofCreator = (name, custom = []) => { const n = norm(name); if (n.length < 4) return []; return all(custom).filter(u => u.founders.some(f => norm(f) === n)); };
// Teinte stable par univers (cartes sans image) : couleur de la famille (Marvel rouge, DC bleu…), légèrement variée
const FAMILY_HUE = Object.freeze({ marvel: 356, dc: 214, image: 168, indie: 28, licence: 268, user: 140 });
const hue = (key, family) => { const u = UNIVERSES.find(x => x.key === key); const v = [...String(key)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 997, 11) % 30 - 15; return ((FAMILY_HUE[u ? u.family : family] || 0) + v + 360) % 360; };

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

module.exports = { FAMILIES, UNIVERSES, CUSTOM_MAX, periodLabel, isActive, validateCustom, sanitizeCustomList, all, byFamily, find, ofName, ofCreator, hue, isPlaceholderImage, relevance, score, rank };
