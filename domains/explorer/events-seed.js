'use strict';
// Catalogue initial des événements (D-49) : faits relevés le 8 novembre 2026 sur Wikipédia (en), une source par événement.
// Seuls des faits sont repris (titres, numéros, dates, auteurs, relations explicitement citées) ; aucun texte copié, aucune image.
// Statut : « non vérifié » tant qu'une seconde source (base spécialisée, éditeur) ne les a pas confirmés ; complétude « partiel ».
// Aucune date intermédiaire n'est déduite : seules les dates citées par la source sont renseignées.
// Les relations entre événements ne portent un guideId que si l'autre événement est dans le catalogue ET que la source les relie.

const AT = '2026-11-08T00:00:00.000Z';
const LIC = 'Texte sous licence CC BY-SA 4.0 : seuls des faits (titres, numéros, dates, auteurs, relations) sont repris ; aucune image.';
const wp = (key, title, path) => ({ id: 'src_wp_' + key, label: 'Wikipédia (en) — ' + title, url: 'https://en.wikipedia.org/wiki/' + path, retrievedAt: '2026-11-08', license: LIC, kind: 'reference' });
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
const issues = (nums, extra = {}) => nums.map(n => Object.assign({ issue: n }, extra[n] || {}));
// Ordre de publication de la série principale : l'ordre des numéros, tel que publié (pas un ordre de lecture recommandé)
const pubOrder = (key, series, volume, nums, publisher, srcId, year) => ({ id: 'ord_' + key + '_pub', type: 'publication', label: 'Ordre de publication (série principale)', sourceId: srcId, derivedFrom: '',
  entries: nums.map(n => ({ series, volume: volume || '', issue: n, publisher, year: year || '', sourceId: srcId })) });
const base = (o) => Object.assign({ kind: 'guide', origin: 'seed', seedVersion: 1, featured: false, category: 'major_event', languages: ['en'], aliases: [], characters: [], prerequisites: [], editions: [],
  image: null, spoilerNote: '', completeness: 'partial', verifiedAt: '', createdAt: AT, updatedAt: AT }, o);

const EVENT_SEEDS = Object.freeze([
  base({
    id: 'gd_secret_wars_1984', title: 'Marvel Super Heroes Secret Wars', originalTitle: 'Marvel Super Heroes Secret Wars', aliases: ['Secret Wars (1984)'], publisher: 'Marvel', periodStart: 1984, periodEnd: 1985,
    synopsis: 'Série limitée Marvel de douze numéros parue de 1984 à 1985, réunissant héros et vilains de l\'éditeur.',
    description: 'Fiche établie à partir d\'une seule source ; répartition des dessinateurs par numéro non renseignée.',
    sources: [wp('sw84', 'Secret Wars', 'Secret_Wars')],
    creators: [{ name: 'Jim Shooter', roles: ['writer'], scope: 'Série principale', sourceId: 'src_wp_sw84' }, { name: 'Mike Zeck', roles: ['artist'], scope: 'Série principale', sourceId: 'src_wp_sw84' }, { name: 'Bob Layton', roles: ['artist'], scope: 'Série principale', sourceId: 'src_wp_sw84' }],
    relations: [{ type: 'followed_by', title: 'Secret Wars II (1985)', sourceId: 'src_wp_sw84' }],
    orders: [pubOrder('sw84', 'Marvel Super Heroes Secret Wars', '', range(1, 12), 'Marvel', 'src_wp_sw84')],
    event: { universe: 'Univers Marvel', mainSeries: { series: 'Marvel Super Heroes Secret Wars', publisher: 'Marvel', sourceId: 'src_wp_sw84',
      issues: issues(range(1, 12), { 1: { coverDate: '1984-05', sourceId: 'src_wp_sw84' }, 12: { coverDate: '1985-04', sourceId: 'src_wp_sw84' } }) }, links: [] }
  }),
  base({
    id: 'gd_infinity_gauntlet', title: 'The Infinity Gauntlet', originalTitle: 'The Infinity Gauntlet', aliases: ['Infinity Gauntlet', 'Le Gant de l\'infini'], publisher: 'Marvel', periodStart: 1991, periodEnd: 1991,
    synopsis: 'Série limitée Marvel de six numéros (1991) consacrée à Thanos et au Gant de l\'infini.',
    description: 'Préludes et tie-ins repris de la source ; ordre de lecture recommandé non renseigné.',
    sources: [wp('ig', 'The Infinity Gauntlet', 'The_Infinity_Gauntlet')],
    characters: [{ name: 'Thanos', sourceId: 'src_wp_ig' }],
    creators: [{ name: 'Jim Starlin', roles: ['writer'], scope: 'Série principale', sourceId: 'src_wp_ig' }, { name: 'George Pérez', roles: ['artist'], scope: '#1-3 et une partie du #4', sourceId: 'src_wp_ig' }, { name: 'Ron Lim', roles: ['artist'], scope: 'Partie du #4, #5-6', sourceId: 'src_wp_ig' }],
    relations: [{ type: 'followed_by', title: 'The Infinity War (1992)', sourceId: 'src_wp_ig' }],
    orders: [pubOrder('ig', 'The Infinity Gauntlet', '', range(1, 6), 'Marvel', 'src_wp_ig', '1991')],
    event: { universe: 'Univers Marvel', mainSeries: { series: 'The Infinity Gauntlet', publisher: 'Marvel', sourceId: 'src_wp_ig',
      issues: issues(range(1, 6), {
        1: { coverDate: '1991-07', creators: [{ name: 'Jim Starlin', roles: ['writer'] }, { name: 'George Pérez', roles: ['artist'] }], sourceId: 'src_wp_ig' },
        2: { creators: [{ name: 'Jim Starlin', roles: ['writer'] }, { name: 'George Pérez', roles: ['artist'] }], sourceId: 'src_wp_ig' },
        3: { creators: [{ name: 'Jim Starlin', roles: ['writer'] }, { name: 'George Pérez', roles: ['artist'] }], sourceId: 'src_wp_ig' },
        4: { creators: [{ name: 'Jim Starlin', roles: ['writer'] }, { name: 'George Pérez', roles: ['artist'] }, { name: 'Ron Lim', roles: ['artist'] }], sourceId: 'src_wp_ig' },
        5: { creators: [{ name: 'Jim Starlin', roles: ['writer'] }, { name: 'Ron Lim', roles: ['artist'] }], sourceId: 'src_wp_ig' },
        6: { coverDate: '1991-12', creators: [{ name: 'Jim Starlin', roles: ['writer'] }, { name: 'Ron Lim', roles: ['artist'] }], sourceId: 'src_wp_ig' } }) },
      links: [
        { relation: 'prelude', series: 'Silver Surfer', volume: 'Vol. 3', issues: '34-50', sourceId: 'src_wp_ig' },
        { relation: 'prelude', series: 'The Thanos Quest', issues: '1-2', sourceId: 'src_wp_ig' },
        { relation: 'tie_in', series: 'Silver Surfer', volume: 'Vol. 3', issues: '51-59', sourceId: 'src_wp_ig' },
        { relation: 'tie_in', series: 'Doctor Strange, Sorcerer Supreme', issues: '31-36', sourceId: 'src_wp_ig' },
        { relation: 'tie_in', series: 'The Incredible Hulk', volume: 'Vol. 2', issues: '384-385', sourceId: 'src_wp_ig' },
        { relation: 'tie_in', series: 'Cloak and Dagger', volume: 'Vol. 3', issues: '18', sourceId: 'src_wp_ig' },
        { relation: 'tie_in', series: 'Quasar', issues: '26', sourceId: 'src_wp_ig' },
        { relation: 'tie_in', series: 'Sleepwalker', issues: '7', sourceId: 'src_wp_ig' }] }
  }),
  base({
    id: 'gd_house_of_m', title: 'House of M', originalTitle: 'House of M', publisher: 'Marvel', periodStart: 2005, periodEnd: 2005,
    synopsis: 'Série limitée Marvel de huit numéros (2005), suivie des récits de la « Décimation ».',
    description: 'Préludes, tie-ins, épilogue et suites repris de la source.',
    sources: [wp('hom', 'House of M', 'House_of_M')],
    creators: [{ name: 'Brian Michael Bendis', roles: ['writer'], scope: 'Série principale', sourceId: 'src_wp_hom' }, { name: 'Olivier Coipel', roles: ['artist'], scope: 'Série principale', sourceId: 'src_wp_hom' }],
    relations: [{ type: 'preceded_by', title: 'Avengers Disassembled', sourceId: 'src_wp_hom' }, { type: 'related', title: 'Civil War (2006)', guideId: 'gd_civil_war', note: 'Civil War s\'appuie sur House of M selon sa propre source.', sourceId: 'src_wp_hom' }],
    orders: [pubOrder('hom', 'House of M', '', range(1, 8), 'Marvel', 'src_wp_hom', '2005')],
    event: { universe: 'Univers Marvel', mainSeries: { series: 'House of M', publisher: 'Marvel', sourceId: 'src_wp_hom',
      issues: issues(range(1, 8), { 1: { coverDate: '2005-06', sourceId: 'src_wp_hom' }, 8: { coverDate: '2005-11', sourceId: 'src_wp_hom' } }) },
      links: [
        { relation: 'prelude', series: 'Excalibur', volume: 'Vol. 3', issues: '13-14', note: 'Introduction de l\'événement selon la source.', sourceId: 'src_wp_hom' },
        { relation: 'tie_in', series: 'Excalibur', volume: 'Vol. 3', issues: '11-12', sourceId: 'src_wp_hom' },
        { relation: 'tie_in', series: 'Fantastic Four: House of M', issues: '1-3', sourceId: 'src_wp_hom' },
        { relation: 'tie_in', series: 'Iron Man: House of M', issues: '1-3', sourceId: 'src_wp_hom' },
        { relation: 'tie_in', series: 'Spider-Man: House of M', issues: '1-5', sourceId: 'src_wp_hom' },
        { relation: 'tie_in', series: 'Mutopia X', issues: '1-5', sourceId: 'src_wp_hom' },
        { relation: 'tie_in', series: 'Uncanny X-Men', issues: '462-465', sourceId: 'src_wp_hom' },
        { relation: 'tie_in', series: 'New X-Men: Academy X', issues: '16-19', sourceId: 'src_wp_hom' },
        { relation: 'tie_in', series: 'The Incredible Hulk', issues: '83-86', sourceId: 'src_wp_hom' },
        { relation: 'tie_in', series: 'Wolverine', issues: '33-35', sourceId: 'src_wp_hom' },
        { relation: 'tie_in', series: 'Captain America', issues: '10', sourceId: 'src_wp_hom' },
        { relation: 'tie_in', series: 'Black Panther', issues: '7', sourceId: 'src_wp_hom' },
        { relation: 'tie_in', series: 'Cable & Deadpool', issues: '17', sourceId: 'src_wp_hom' },
        { relation: 'tie_in', series: 'Exiles', issues: '69-71', sourceId: 'src_wp_hom' },
        { relation: 'tie_in', series: 'New Thunderbolts', issues: '11', sourceId: 'src_wp_hom' },
        { relation: 'tie_in', series: 'The Pulse', issues: '10', sourceId: 'src_wp_hom' },
        { relation: 'related_series', series: 'Secrets of the House of M', issues: '1', sourceId: 'src_wp_hom' },
        { relation: 'related_series', series: 'What If? House of M', issues: '1', sourceId: 'src_wp_hom' },
        { relation: 'epilogue', series: 'New Avengers', issues: '16-20', sourceId: 'src_wp_hom' },
        { relation: 'aftermath', series: 'Decimation: House of M – The Day After', issues: '1', sourceId: 'src_wp_hom' },
        { relation: 'aftermath', series: 'Son of M', sourceId: 'src_wp_hom' },
        { relation: 'aftermath', series: 'Generation M', sourceId: 'src_wp_hom' },
        { relation: 'aftermath', series: 'New Excalibur', sourceId: 'src_wp_hom' }] }
  }),
  base({
    id: 'gd_civil_war', title: 'Civil War', originalTitle: 'Civil War', aliases: ['Civil War (2006)'], publisher: 'Marvel', periodStart: 2006, periodEnd: 2007,
    synopsis: 'Série limitée Marvel de sept numéros (2006-2007) sur l\'affrontement des héros autour d\'une loi de recensement.',
    description: 'Principales séries liées citées par la source ; numéros des tie-ins non renseignés.',
    sources: [wp('cw', 'Civil War (comics)', 'Civil_War_(comics)')],
    creators: [{ name: 'Mark Millar', roles: ['writer'], scope: 'Série principale', sourceId: 'src_wp_cw' }, { name: 'Steve McNiven', roles: ['artist'], scope: 'Série principale', sourceId: 'src_wp_cw' }],
    relations: [{ type: 'related', title: 'House of M (2005)', guideId: 'gd_house_of_m', note: 'S\'appuie sur Avengers Disassembled, House of M et Decimation selon la source.', sourceId: 'src_wp_cw' }, { type: 'followed_by', title: 'Civil War II (2016)', sourceId: 'src_wp_cw' }],
    orders: [pubOrder('cw', 'Civil War', '', range(1, 7), 'Marvel', 'src_wp_cw')],
    event: { universe: 'Univers Marvel', mainSeries: { series: 'Civil War', publisher: 'Marvel', sourceId: 'src_wp_cw',
      issues: issues(range(1, 7), { 1: { coverDate: '2006-07', sourceId: 'src_wp_cw' }, 7: { coverDate: '2007-02', sourceId: 'src_wp_cw' } }) },
      links: [
        { relation: 'tie_in', series: 'Civil War: Front Line', sourceId: 'src_wp_cw' },
        { relation: 'tie_in', series: 'Civil War: X-Men', sourceId: 'src_wp_cw' },
        { relation: 'tie_in', series: 'Civil War: Young Avengers/Runaways', sourceId: 'src_wp_cw' },
        { relation: 'tie_in', series: 'Civil War: The Initiative', sourceId: 'src_wp_cw' },
        { relation: 'tie_in', series: 'Fallen Son: The Death of Captain America', sourceId: 'src_wp_cw' }] }
  }),
  base({
    id: 'gd_crisis_infinite_earths', title: 'Crisis on Infinite Earths', originalTitle: 'Crisis on Infinite Earths', aliases: ['Crisis', 'Crise sur les Terres infinies'], publisher: 'DC', periodStart: 1985, periodEnd: 1986,
    synopsis: 'Série limitée DC de douze numéros (1985-1986), qui réorganise le multivers de l\'éditeur.',
    description: 'Séries croisées citées par la source sans numéros précis.',
    sources: [wp('coie', 'Crisis on Infinite Earths', 'Crisis_on_Infinite_Earths')],
    creators: [{ name: 'Marv Wolfman', roles: ['writer'], scope: 'Série principale', sourceId: 'src_wp_coie' }, { name: 'George Pérez', roles: ['artist'], scope: 'Série principale', sourceId: 'src_wp_coie' }],
    relations: [{ type: 'followed_by', title: 'Infinite Crisis (2005-2006)', guideId: 'gd_infinite_crisis', sourceId: 'src_wp_coie' }, { type: 'related', title: 'Zero Hour: Crisis in Time! (1994)', sourceId: 'src_wp_coie' }],
    orders: [pubOrder('coie', 'Crisis on Infinite Earths', '', range(1, 12), 'DC', 'src_wp_coie')],
    event: { universe: 'Univers DC', mainSeries: { series: 'Crisis on Infinite Earths', publisher: 'DC', sourceId: 'src_wp_coie',
      issues: issues(range(1, 12), { 1: { coverDate: '1985-04', sourceId: 'src_wp_coie' }, 12: { coverDate: '1986-03', sourceId: 'src_wp_coie' } }) },
      links: [
        { relation: 'related_series', series: 'History of the DC Universe', note: 'Série compagnon.', sourceId: 'src_wp_coie' },
        ...['All-Star Squadron', 'Blue Devil', 'DC Comics Presents', 'The Fury of Firestorm', 'Infinity, Inc.', 'Justice League of America', 'Legion of Super-Heroes', 'The Omega Men', 'Swamp Thing', 'Wonder Woman']
          .map(s => ({ relation: 'crossover', series: s, sourceId: 'src_wp_coie' }))] }
  }),
  base({
    id: 'gd_infinite_crisis', title: 'Infinite Crisis', originalTitle: 'Infinite Crisis', publisher: 'DC', periodStart: 2005, periodEnd: 2006,
    synopsis: 'Série limitée DC de sept numéros (2005-2006), suite de Crisis on Infinite Earths.',
    description: 'Préludes et suites cités par la source.',
    sources: [wp('ic', 'Infinite Crisis', 'Infinite_Crisis')],
    creators: [{ name: 'Geoff Johns', roles: ['writer'], scope: 'Série principale', sourceId: 'src_wp_ic' }, ...['Phil Jimenez', 'Jerry Ordway', 'George Pérez', 'Ivan Reis'].map(n => ({ name: n, roles: ['artist'], scope: 'Série principale', sourceId: 'src_wp_ic' }))],
    relations: [{ type: 'preceded_by', title: 'Crisis on Infinite Earths (1985)', guideId: 'gd_crisis_infinite_earths', sourceId: 'src_wp_ic' }],
    orders: [pubOrder('ic', 'Infinite Crisis', '', range(1, 7), 'DC', 'src_wp_ic')],
    event: { universe: 'Univers DC', mainSeries: { series: 'Infinite Crisis', publisher: 'DC', sourceId: 'src_wp_ic',
      issues: issues(range(1, 7), { 1: { coverDate: '2005-12', sourceId: 'src_wp_ic' }, 7: { coverDate: '2006-06', sourceId: 'src_wp_ic' } }) },
      links: [
        ...['Countdown to Infinite Crisis', 'The OMAC Project', 'Rann–Thanagar War', 'Day of Vengeance', 'Villains United', 'DC Special: The Return of Donna Troy'].map(s => ({ relation: 'prelude', series: s, sourceId: 'src_wp_ic' })),
        { relation: 'aftermath', series: '52', sourceId: 'src_wp_ic' }, { relation: 'aftermath', series: 'One Year Later', note: 'Saut éditorial d\'un an dans les séries DC.', sourceId: 'src_wp_ic' }] }
  }),
  base({
    id: 'gd_blackest_night', title: 'Blackest Night', originalTitle: 'Blackest Night', publisher: 'DC', periodStart: 2009, periodEnd: 2010,
    synopsis: 'Événement DC (2009-2010) lié aux séries Green Lantern ; série principale numérotée de 0 à 8.',
    description: 'Tie-ins principaux cités par la source.',
    sources: [wp('bn', 'Blackest Night', 'Blackest_Night')],
    creators: [{ name: 'Geoff Johns', roles: ['writer'], scope: 'Série principale', sourceId: 'src_wp_bn' }, { name: 'Ivan Reis', roles: ['artist'], scope: 'Série principale', sourceId: 'src_wp_bn' }],
    relations: [{ type: 'preceded_by', title: 'Sinestro Corps War', sourceId: 'src_wp_bn' }, { type: 'followed_by', title: 'Brightest Day', sourceId: 'src_wp_bn' }],
    orders: [pubOrder('bn', 'Blackest Night', '', range(0, 8), 'DC', 'src_wp_bn')],
    event: { universe: 'Univers DC', mainSeries: { series: 'Blackest Night', publisher: 'DC', sourceId: 'src_wp_bn',
      issues: issues(range(0, 8), { 0: { coverDate: '2009-06', sourceId: 'src_wp_bn' }, 8: { coverDate: '2010-05', sourceId: 'src_wp_bn' } }) },
      links: [
        { relation: 'tie_in', series: 'Green Lantern', volume: 'Vol. 4', issues: '43-52', sourceId: 'src_wp_bn' },
        { relation: 'tie_in', series: 'Green Lantern Corps', volume: 'Vol. 2', issues: '39-47', sourceId: 'src_wp_bn' },
        ...['Blackest Night: Batman', 'Blackest Night: Superman', 'Blackest Night: The Flash', 'Blackest Night: Titans', 'Blackest Night: Wonder Woman', 'Blackest Night: JSA', 'Blackest Night: Tales of the Corps']
          .map(s => ({ relation: 'tie_in', series: s, sourceId: 'src_wp_bn' }))] }
  }),
  base({
    id: 'gd_flashpoint', title: 'Flashpoint', originalTitle: 'Flashpoint', publisher: 'DC', periodStart: 2011, periodEnd: 2011,
    synopsis: 'Série limitée DC de cinq numéros (2011) centrée sur Flash, qui précède la relance « The New 52 ».',
    description: 'La source ne cite que des exemples de tie-ins : liste partielle.',
    sources: [wp('fp', 'Flashpoint (comics)', 'Flashpoint_(comics)')],
    characters: [{ name: 'Flash (Barry Allen)', sourceId: 'src_wp_fp' }],
    creators: [{ name: 'Geoff Johns', roles: ['writer'], scope: 'Série principale', sourceId: 'src_wp_fp' }, { name: 'Andy Kubert', roles: ['artist'], scope: 'Série principale', sourceId: 'src_wp_fp' }],
    relations: [{ type: 'followed_by', title: 'The New 52 (relance DC, 2011)', sourceId: 'src_wp_fp' }, { type: 'related', title: 'Flashpoint Beyond (2022)', sourceId: 'src_wp_fp' }],
    orders: [pubOrder('fp', 'Flashpoint', '', range(1, 5), 'DC', 'src_wp_fp', '2011')],
    event: { universe: 'Univers DC', mainSeries: { series: 'Flashpoint', publisher: 'DC', sourceId: 'src_wp_fp',
      issues: issues(range(1, 5), { 1: { coverDate: '2011-05', sourceId: 'src_wp_fp' }, 5: { coverDate: '2011-08', sourceId: 'src_wp_fp' } }) },
      links: [
        { relation: 'prelude', series: 'The Flash', volume: 'Vol. 3', issues: '8-12', sourceId: 'src_wp_fp' },
        { relation: 'crossover', series: 'Booster Gold', volume: 'Vol. 2', issues: '44-47', sourceId: 'src_wp_fp' },
        ...['Flashpoint: Batman – Knight of Vengeance', 'Flashpoint: Deadman and the Flying Graysons', 'Flashpoint: Citizen Cold', 'Flashpoint: Deathstroke & the Curse of the Ravager', 'Flashpoint: The Legion of Doom', 'Flashpoint: The Outsider']
          .map(s => ({ relation: 'tie_in', series: s, sourceId: 'src_wp_fp' }))] }
  })
]);

// Complément documentaire de King in Black (guide livré depuis le lot 2.6) : série principale et tie-ins nommés par la source
const KIB_SOURCE = wp('kib', 'King in Black', 'King_in_Black');
const KIB_EVENT = Object.freeze({ universe: 'Univers Marvel',
  mainSeries: { series: 'King in Black', publisher: 'Marvel', sourceId: 'src_wp_kib',
    issues: issues(range(1, 5), {
      1: { releaseDate: '2020-12-02', creators: [{ name: 'Donny Cates', roles: ['writer'] }, { name: 'Ryan Stegman', roles: ['artist'] }, { name: 'JP Mayer', roles: ['inker'] }], sourceId: 'src_wp_kib' },
      5: { releaseDate: '2021-04-07', creators: [{ name: 'Donny Cates', roles: ['writer'] }, { name: 'Ryan Stegman', roles: ['artist'] }, { name: 'JP Mayer', roles: ['inker'] }], sourceId: 'src_wp_kib' } }) },
  links: [
    ...[['Symbiote Spider-Man: King in Black', '1-5'], ['King in Black: Namor', '1-5'], ['King in Black: Planet of the Symbiotes', '1-3'], ['King in Black: Thunderbolts', '1-3'], ['King in Black: Gwenom vs. Carnage', '1-3'], ['King in Black: Return of the Valkyries', '1-4']]
      .map(([s, i]) => ({ relation: 'tie_in', series: s, issues: i, sourceId: 'src_wp_kib' })),
    ...['King in Black: Black Knight', 'King in Black: Black Panther', 'King in Black: Captain America', 'King in Black: Ghost Rider', 'King in Black: Immortal Hulk', 'King in Black: Iron Man/Doom', 'King in Black: Marauders', 'King in Black: Scream', 'King in Black: Spider-Man', 'King in Black: Wiccan and Hulkling']
      .map(s => ({ relation: 'tie_in', series: s, issues: '1', sourceId: 'src_wp_kib' })),
    { relation: 'tie_in', series: 'Atlantis Attacks', note: 'Série de cinq numéros ; lien avec l\'événement à préciser par numéro.', sourceId: 'src_wp_kib' },
    { relation: 'related_series', series: 'King in Black Handbook', issues: '1', sourceId: 'src_wp_kib' },
    { relation: 'related_series', series: 'Venom', volume: 'Vol. 4', issues: '31-34', note: 'Requise selon l\'ordre de la source du guide, suivie de Venom #200 (également numéroté #35 selon cette source).', sourceId: 'src_cbro' }] });

module.exports = { EVENT_SEEDS, KIB_SOURCE, KIB_EVENT, SEED_RETRIEVED: '2026-11-08' };
