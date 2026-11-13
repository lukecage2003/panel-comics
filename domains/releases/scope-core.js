'use strict';
// Périmètre « comics uniquement » des Sorties (D-37, D-41, D-54 ; éditeurs US et FR de comics, 13 novembre 2026).
// Module pur : aucune dépendance, aucun accès au stockage ni au réseau. Extrait de index.html (Phase 0 du PRD V1, D-58).
//  - SCOPE_RULES : listes d'exclusion (manga, manhwa/manhua/webtoon, BD franco-belge). Elles protègent le périmètre.
//  - PUBLISHERS : éditeurs de comics proposés (nom canonique, marché US ou FR, alias normalisés).
//  - scopeReason(p) : null si la publication est dans le périmètre, sinon l'identifiant de la règle.
//  Éditeur mixte (Glénat, Delcourt, Humanoïdes…) : jamais exclu sur le seul nom ; seul le format décide (D-41).

const norm = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const SCOPE_RULES = Object.freeze([
  Object.freeze({ id: 'manga', label: 'Manga', publishers: Object.freeze(['kana', 'kurokawa', 'ki oon', 'pika', 'pika edition', 'kaze', 'kaze manga', 'tonkam', 'akata', 'doki doki', 'ototo', 'naban', 'meian', 'viz media', 'viz', 'kodansha', 'kodansha usa', 'yen press', 'seven seas', 'tokyopop', 'vertical', 'kodansha comics', 'square enix manga', 'square enix', 'yen on', 'j novel club', 'denpa', 'ghost ship', 'airship', 'one peace books', 'udon manga', 'shueisha', 'shogakukan', 'kioon', 'soleil manga', 'mangetsu', 'noeve grafx', 'crunchyroll']) }),
  Object.freeze({ id: 'manhwa', label: 'Manhwa, manhua, webtoon (M2)', publishers: Object.freeze(['delitoon', 'webtoon', 'webtoon unscrolled', 'tapas', 'ize press', 'kbooks']) }),
  Object.freeze({ id: 'bd', label: 'Bande dessinée franco-belge (M1)', publishers: Object.freeze(['dargaud', 'dupuis', 'casterman', 'le lombard', 'lombard', 'blake et mortimer', 'ankama', 'bamboo', 'soleil', 'futuropolis', 'rue de sevres', 'gallimard bd', 'fluide glacial']) }),
  // Tout autre éditeur nommé, absent de la liste des éditeurs de comics US et FR (romans, jeunesse, magazines, éditeurs étrangers…)
  Object.freeze({ id: 'other', label: 'Éditeur hors comics US et FR', publishers: Object.freeze([]) })
]);
const SCOPE_INDEX = new Map(SCOPE_RULES.flatMap(rule => rule.publishers.map(n => [n, rule.id])));

const PUBLISHERS = Object.freeze([
  ['Marvel', 'US', ['marvel comics', 'marvel worldwide']], ['DC Comics', 'US', ['dc', 'dc entertainment']],
  ['Image Comics', 'US', ['image']], ['Dark Horse', 'US', ['dark horse comics']], ['IDW Publishing', 'US', ['idw']],
  ['BOOM! Studios', 'US', ['boom studios', 'boom']], ['Dynamite', 'US', ['dynamite entertainment']], ['Oni Press', 'US', ['oni']],
  ['Titan Comics', 'US', ['titan']], ['Mad Cave Studios', 'US', ['mad cave']], ['Skybound', 'US', ['skybound entertainment']],
  ['Valiant', 'US', ['valiant entertainment']], ['Archie Comics', 'US', ['archie']], ['AWA Studios', 'US', ['awa']],
  ['Ahoy Comics', 'US', ['ahoy']], ['Vault Comics', 'US', ['vault']], ['Mad Cave', 'US', []],
  ['Zenescope', 'US', ['zenescope entertainment']], ['Ablaze', 'US', ['ablaze publishing']], ['AfterShock Comics', 'US', ['aftershock']],
  ['Scout Comics', 'US', ['scout']], ['Source Point Press', 'US', ['source point']], ['Behemoth Comics', 'US', ['behemoth']],
  ['Massive Publishing', 'US', ['massive']], ['Antarctic Press', 'US', []], ['Lion Forge', 'US', []], ['Fantagraphics', 'US', ['fantagraphics books']],
  ['Top Shelf', 'US', ['top shelf productions']], ['Papercutz', 'US', []], ['Heavy Metal', 'US', []], ['Bad Idea', 'US', []],
  ['DSTLRY', 'US', []], ['Whatnot Publishing', 'US', ['whatnot']], ['Floating World Comics', 'US', []], ['Image Comics Skybound', 'US', []],
  ['Marvel Comics Group', 'US', []], ['DC Black Label', 'US', ['vertigo', 'wildstorm', 'dc vertigo']], ['Dark Horse Books', 'US', []],
  ['Humanoids', 'US', ['humanoids inc']], ['Aspen Comics', 'US', ['aspen mlt', 'aspen']], ['Coffin Comics', 'US', []], ['Keenspot', 'US', []],
  ['Abrams ComicArts', 'US', ['abrams']], ['First Second', 'US', ['first second books']], ['Drawn & Quarterly', 'US', ['drawn and quarterly']],
  ['Image', 'US', []], ['Free Comic Book Day', 'US', ['fcbd']], ['Titan Books', 'US', []], ['Udon Entertainment', 'US', ['udon']],
  ['Huginn & Muninn', 'FR', ['huginn muninn', 'huginn et muninn']], ['Akileos', 'FR', []], ['Snorgleux', 'FR', ['snorgleux comics']],
  ['Black River', 'FR', []], ['Ankama Comics', 'FR', []], ['404 Comics', 'FR', ['404 editions']], ['Graph Zeppelin', 'FR', []], ['Delirium', 'FR', ['editions delirium']],
  ['Panini Comics', 'FR', ['panini', 'panini france', 'panini comics france']], ['Urban Comics', 'FR', ['urban']],
  ['Delcourt', 'FR', ['delcourt comics', 'editions delcourt']], ['Glénat', 'FR', ['glenat comics', 'editions glenat']],
  ['Bliss Comics', 'FR', ['bliss']], ['HiComics', 'FR', ['hi comics']], ['Komics Initiative', 'FR', []], ['Vestron', 'FR', []],
  ['Les Humanoïdes Associés', 'FR', ['humanoides associes', 'les humanoides associes']]
].map(x => Object.freeze([x[0], x[1], Object.freeze(x[2])])));

const MARKETS = Object.freeze(['US', 'FR']);
// Liste blanche : noms et alias normalisés des éditeurs de comics US et FR
const PUBLISHER_KEYS = new Set(PUBLISHERS.flatMap(([n, , al]) => [norm(n)].concat(al)));

// Raison d'exclusion d'une publication ({ format, publisher, scope }) ; null = dans le périmètre
const scopeReason = p => {
  if (!p) return null;
  if (p.scope === 'in') return null;
  if (p.format === 'manga') return 'manga';
  const k = norm(p.publisher);
  if (!k) return null; // éditeur absent : rien ne permet de l'écarter
  const known = SCOPE_INDEX.get(k);
  if (known) return known;
  return PUBLISHER_KEYS.has(k) ? null : 'other';
};
const isOutOfScope = p => !!scopeReason(p);
// Éditeur exclu par son nom (pour ne jamais le proposer dans une liste)
const isExcludedPublisher = name => SCOPE_INDEX.has(norm(name));

// Nom canonique et marché d'un éditeur connu ; sinon le nom tel quel et un marché vide
const resolvePublisher = (name, maxLen = 100) => {
  const raw = String(name == null ? '' : name).trim().slice(0, maxLen);
  const k = norm(raw);
  if (!k) return { name: '', market: '' };
  const hit = PUBLISHERS.find(([n, , al]) => norm(n) === k || al.includes(k));
  return hit ? { name: hit[0], market: hit[1] } : { name: raw, market: '' };
};

module.exports = { norm, SCOPE_RULES, PUBLISHERS, MARKETS, scopeReason, isOutOfScope, isExcludedPublisher, resolvePublisher };
