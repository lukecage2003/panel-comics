'use strict';
// Analyses de collection (D-63) : créateurs, personnages et équipes les plus présents ou les plus lus,
// et indicateurs financiers (prix de couverture, prix payé, seconde main, plus-values, dépenses par mois).
//  - Les crédits viennent de Comic Vine (fiche du numéro, mise en cache sur l'appareil) ; sans crédit connu,
//    personnages et équipes sont déduits du titre de la série et marqués comme tels.
//  - Module pur : rien n'est stocké ni envoyé ; aucune valeur n'est inventée.

const norm = s => String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// Équipes reconnues dans un titre de série (repli quand Comic Vine n'a pas fourni les crédits)
const TEAMS = Object.freeze([
  ['X-Men', /x men|x force|x factor|uncanny x|krakoa|new mutants/],
  ['Avengers', /avengers/],
  ['Justice League', /justice league|\bjla\b/],
  ['Fantastic Four', /fantastic four/],
  ['Guardians of the Galaxy', /guardians of the galaxy/],
  ['Teen Titans', /teen titans|\btitans\b/],
  ['Suicide Squad', /suicide squad/],
  ['Justice Society', /justice society|\bjsa\b/],
  ['Defenders', /defenders/],
  ['Thunderbolts', /thunderbolts/],
  ['Inhumans', /inhumans/],
  ['Eternals', /eternals/],
  ['Birds of Prey', /birds of prey/],
  ['Doom Patrol', /doom patrol/],
  ['Watchmen', /watchmen/],
  ['Teenage Mutant Ninja Turtles', /ninja turtles|\btmnt\b/]
].map(([n, re]) => Object.freeze([n, re])));
const teamOfSeries = series => { const t = norm(series); const hit = TEAMS.find(([, re]) => re.test(t)); return hit ? hit[0] : null; };

const ROLE = {
  writer: /writer|plotter|script|story/,
  artist: /pencil|artist|inker|\bink\b|layout|finish/,
  cover: /cover/,
  colorist: /colou?r/
};

const workKey = c => norm(c.series) + '#' + norm(String(c.issue || '').replace(/^#/, ''));

const bump = (map, name, read) => {
  const k = String(name || '').trim();
  if (!k) return;
  const r = map.get(k) || { name: k, n: 0, read: 0 };
  r.n++; if (read) r.read++;
  map.set(k, r);
};
const top = (map, by, limit) => [...map.values()].filter(r => r[by] > 0).sort((a, b) => b[by] - a[by] || b.n - a.n || a.name.localeCompare(b.name)).slice(0, limit);

// copies : exemplaires possédés ; options.creditsOf(copy) -> { persons:[{name, role}], characters:[...], teams:[...] } | null
// options.isRead(copy) -> booléen ; options.characterOf(copy) -> nom | null (repli par titre)
// Une œuvre (série + numéro) compte une fois, même avec plusieurs exemplaires.
const creatorInsights = (copies = [], options = {}) => {
  const creditsOf = options.creditsOf || (() => null);
  const isRead = options.isRead || (() => false);
  const charOf = options.characterOf || (() => null);
  const limit = options.limit || 8;
  const works = new Map();
  copies.forEach(c => { if (!c || !c.series) return; const k = workKey(c); const w = works.get(k); if (!w) works.set(k, { copy: c, read: !!isRead(c) }); else if (isRead(c)) w.read = true; });
  const writers = new Map(), artists = new Map(), covers = new Map(), chars = new Map(), teams = new Map();
  let withCredits = 0, inferredChars = 0, inferredTeams = 0;
  works.forEach(({ copy, read }) => {
    const cr = creditsOf(copy);
    if (cr && (cr.persons || cr.characters || cr.teams)) {
      withCredits++;
      (cr.persons || []).forEach(p => {
        const role = norm(p.role);
        if (ROLE.writer.test(role)) bump(writers, p.name, read);
        if (ROLE.artist.test(role)) bump(artists, p.name, read);
        if (ROLE.cover.test(role)) bump(covers, p.name, read);
      });
      (cr.characters || []).forEach(n => bump(chars, n, read));
      (cr.teams || []).forEach(n => bump(teams, n, read));
    } else {
      const ch = charOf(copy); if (ch) { bump(chars, ch, read); inferredChars++; }
      const tm = teamOfSeries(copy.series); if (tm) { bump(teams, tm, read); inferredTeams++; }
    }
  });
  const pack = m => ({ owned: top(m, 'n', limit), read: top(m, 'read', limit) });
  return {
    works: works.size, withCredits, inferredChars, inferredTeams,
    writers: pack(writers), artists: pack(artists), covers: pack(covers), characters: pack(chars), teams: pack(teams)
  };
};

// Réduit une réponse Comic Vine (fiche d'un numéro) à ce que Panel garde en cache
const creditsFromComicVine = r => {
  if (!r || typeof r !== 'object') return null;
  const names = a => (Array.isArray(a) ? a : []).map(x => String((x && x.name) || '').trim().slice(0, 80)).filter(Boolean).slice(0, 40);
  return {
    persons: (Array.isArray(r.person_credits) ? r.person_credits : []).map(p => ({ name: String((p && p.name) || '').trim().slice(0, 80), role: String((p && p.role) || '').slice(0, 80) })).filter(p => p.name).slice(0, 40),
    characters: names(r.character_credits), teams: names(r.team_credits)
  };
};

const money = v => { if (v === null || v === undefined || v === '') return null; const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null; };
const monthOf = d => { const m = String(d || '').match(/^(\d{4})-(\d{2})/); return m ? m[1] + '-' + m[2] : null; };

// copies : { paid, cover, value, date (achat), publisher, series, issue, secondHand }
// now : Date de référence (12 derniers mois)
const financeInsights = (copies = [], now = new Date()) => {
  const rows = copies.filter(Boolean).map(c => ({ ...c, paid: money(c.paid), cover: money(c.cover), value: money(c.value) }));
  const sum = (a, f) => a.reduce((t, x) => t + (f(x) || 0), 0);
  const withPaid = rows.filter(r => r.paid !== null);
  const both = rows.filter(r => r.paid !== null && r.cover !== null && r.cover > 0);
  const second = both.filter(r => r.secondHand);
  const fresh = both.filter(r => !r.secondHand);
  const withValue = rows.filter(r => r.value !== null && r.paid !== null);
  const gain = r => r.value - r.paid;
  // Dépenses des 12 derniers mois
  const months = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ month: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), spent: 0, n: 0 }); }
  withPaid.forEach(r => { const m = months.find(x => x.month === monthOf(r.date)); if (m) { m.spent += r.paid; m.n++; } });
  // Par éditeur
  const pubs = new Map();
  rows.forEach(r => { const k = String(r.publisher || '').trim() || 'Éditeur inconnu'; const p = pubs.get(k) || { name: k, paid: 0, value: 0, n: 0 }; p.paid += r.paid || 0; p.value += r.value || 0; p.n++; pubs.set(k, p); });
  // Tranches de prix payé
  const bands = [[0, 5], [5, 10], [10, 25], [25, 100], [100, Infinity]].map(([lo, hi]) => ({ lo, hi, n: withPaid.filter(r => r.paid >= lo && r.paid < hi).length }));
  const label = r => (String(r.series || '').trim() + ' ' + String(r.issue || '').trim()).trim();
  return {
    count: rows.length,
    paid: sum(withPaid, r => r.paid), coverTotal: sum(rows, r => r.cover), value: sum(rows, r => r.value),
    unknownPaid: rows.length - withPaid.length,
    avgPaid: withPaid.length ? sum(withPaid, r => r.paid) / withPaid.length : null,
    // Écart au prix de couverture (positif = économie)
    vsCover: both.length ? { n: both.length, saved: sum(both, r => r.cover - r.paid), pct: sum(both, r => r.cover) ? (sum(both, r => r.cover - r.paid) / sum(both, r => r.cover)) * 100 : 0 } : null,
    secondHand: { n: rows.filter(r => r.secondHand).length, saved: sum(second, r => r.cover - r.paid), compared: second.length },
    newPrice: { n: fresh.length, saved: sum(fresh, r => r.cover - r.paid) },
    unrealized: withValue.length ? { n: withValue.length, gain: sum(withValue, gain), roi: sum(withValue, r => r.paid) ? sum(withValue, gain) / sum(withValue, r => r.paid) * 100 : null } : null,
    best: withValue.filter(r => gain(r) > 0).sort((a, b) => gain(b) - gain(a)).slice(0, 5).map(r => ({ label: label(r), paid: r.paid, value: r.value, gain: gain(r) })),
    worst: withValue.filter(r => gain(r) < 0).sort((a, b) => gain(a) - gain(b)).slice(0, 5).map(r => ({ label: label(r), paid: r.paid, value: r.value, gain: gain(r) })),
    priciest: withPaid.slice().sort((a, b) => b.paid - a.paid).slice(0, 3).map(r => ({ label: label(r), paid: r.paid })),
    months, bands,
    publishers: [...pubs.values()].sort((a, b) => b.paid - a.paid || b.n - a.n).slice(0, 6)
  };
};

module.exports = { TEAMS, teamOfSeries, creatorInsights, creditsFromComicVine, financeInsights };
