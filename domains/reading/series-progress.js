'use strict';
// Séries en cours (D-75) : à partir des numéros lus (journal de lecture, imports compris) et des numéros connus
// (collection, wishlist), Panel déduit les séries commencées, la progression et le prochain numéro à lire.
// Rien n'est stocké : la liste est recalculée à chaque affichage. Module pur.
//
// entries : [{ key, label, issue, read, current, owned, wished, at }]
//   key     : clé de série normalisée (fournie par l'appelant, même règle que le reste de Panel)
//   issue   : « #12 », « 12 », « 0.5 »… (sans numéro : ignoré, un recueil n'a pas de « suivant »)
//   read    : numéro lu ; current : numéro marqué « en cours » ; owned / wished : possédé / en wishlist
//   at      : date ISO de la dernière lecture connue (peut manquer)

const numOf = v => { const m = String(v == null ? '' : v).replace(/^#\s*/, '').trim().match(/^-?\d+(?:[.,]\d+)?/); return m ? Number(m[0].replace(',', '.')) : null; };
const ONGOING = /\bpresent\b|en cours|ongoing|\(\s*\d{4}\s*[-–]\s*\)/i;

const seriesInProgress = (entries, opts = {}) => {
  const groups = new Map();
  for (const e of entries || []) {
    if (!e || !e.key) continue;
    const n = numOf(e.issue);
    if (n === null) continue;
    let g = groups.get(e.key);
    if (!g) groups.set(e.key, g = { key: e.key, label: '', nums: new Map(), lastAt: '', ongoing: false });
    const label = String(e.label || '');
    if (label.length > g.label.length) g.label = label;
    if (ONGOING.test(label)) g.ongoing = true;
    const x = g.nums.get(n) || { read: false, current: false, owned: false, wished: false, issue: '' };
    x.read = x.read || !!e.read; x.current = x.current || !!e.current; x.owned = x.owned || !!e.owned; x.wished = x.wished || !!e.wished;
    if (!x.issue) x.issue = String(e.issue || '');
    g.nums.set(n, x);
    if (e.read && e.at && String(e.at) > g.lastAt) g.lastAt = String(e.at);
  }
  const out = [];
  for (const g of groups.values()) {
    const known = [...g.nums.keys()].sort((a, b) => a - b);
    const readNums = known.filter(n => g.nums.get(n).read);
    const current = known.find(n => g.nums.get(n).current && !g.nums.get(n).read);
    if (!readNums.length && current === undefined) continue;
    const maxRead = readNums.length ? readNums[readNums.length - 1] : -Infinity;
    const unread = known.filter(n => !g.nums.get(n).read);
    const after = unread.filter(n => n > maxRead);
    const next = current !== undefined ? current : after.length ? after[0] : unread.length ? unread[0] : null;
    const caughtUp = next === null;
    // À jour sans suite connue : gardée seulement pour une série toujours publiée (sinon c'est une série finie, pas « en cours »)
    if (caughtUp && !(g.ongoing && readNums.length >= (opts.minCaughtUp || 2))) continue;
    const nx = next === null ? null : g.nums.get(next);
    out.push({
      key: g.key, label: g.label, read: readNums.length, known: known.length,
      pct: Math.round(readNums.length / known.length * 100),
      lastRead: readNums.length ? g.nums.get(maxRead).issue || '#' + maxRead : '',
      next: nx ? nx.issue || '#' + next : '', nextOwned: !!(nx && nx.owned), nextWished: !!(nx && nx.wished),
      reading: current !== undefined, gaps: unread.filter(n => n < maxRead).length,
      unreadOwned: unread.filter(n => g.nums.get(n).owned).length,
      state: current !== undefined ? 'reading' : caughtUp ? 'caught-up' : 'resume', ongoing: g.ongoing, lastAt: g.lastAt
    });
  }
  const rank = s => s.state === 'reading' ? 0 : s.state === 'resume' ? (s.nextOwned ? 1 : 2) : 3;
  return out.sort((a, b) => rank(a) - rank(b) || String(b.lastAt).localeCompare(String(a.lastAt)) || b.read - a.read || a.label.localeCompare(b.label));
};

module.exports = { seriesInProgress, numOf };
