'use strict';
// Statistiques avancées Panel+ (D-114) — module pur, calculé sur l'appareil à partir des exemplaires de la collection.
// Les statistiques de base (valeur, décennies, créateurs, dépenses) restent gratuites ; ces analyses-ci sont réservées
// à Panel+ et ne quittent jamais l'appareil. Aucune valeur n'est inventée : un exemplaire sans prix ni cote est compté
// à part (« sans cote ») et n'entre pas dans les calculs de rendement. Aucune prévision de prix n'est faite.

const num = v => { if (v === null || v === undefined || v === '') return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) && n >= 0 ? n : null; };
const monthOf = d => { const m = String(d || '').match(/^(\d{4})-(\d{2})/); return m ? m[1] + '-' + m[2] : null; };
const pubOf = c => String(c.publisher || '').trim() || 'Éditeur inconnu';
const label = c => (String(c.series || '').trim() + (c.issue ? ' #' + String(c.issue).trim() : '')).trim();
const GRADED = /\b(cgc|cbcs|pgx)\b|\b(10(\.0)?|[0-9]\.[0-9])\b/i;

// Fonctions offertes et fonctions Panel+ (affichées telles quelles dans l'écran Statistiques)
const FREE = Object.freeze(['Valeur estimée et prix payé', 'Répartition par décennie', 'Créateurs et personnages les plus présents', 'Dépenses des 12 derniers mois']);
const PLUS = Object.freeze([
  { key: 'concentration', label: 'Concentration de la valeur', about: 'Part de la valeur portée par vos 10 exemplaires les plus cotés, et dépendance à un éditeur.' },
  { key: 'roi', label: 'Rendement par éditeur', about: 'Cote actuelle comparée au prix payé, éditeur par éditeur.' },
  { key: 'keys', label: 'Key Issues', about: 'Nombre, valeur et rendement de vos Key Issues.' },
  { key: 'grading', label: 'Gradés et variantes', about: 'Part des exemplaires gradés (CGC, CBCS, PGX) et des couvertures variantes.' },
  { key: 'pace', label: 'Rythme d’achat', about: 'Achats par mois sur 12 mois, comparés aux 12 mois précédents.' },
  { key: 'hold', label: 'Durée de détention', about: 'Depuis combien de temps vous gardez vos exemplaires, et les plus anciens.' }
]);
const gate = (entitled, key) => !!entitled || !PLUS.some(p => p.key === key);

const rowsOf = copies => (copies || []).filter(Boolean).map(c => ({ c, paid: num(c.purchasePrice), value: num(c.estValue), date: c.purchaseDate || c.addedAt || '' }));

// Concentration : part des 10 premiers exemplaires et indice de dépendance (Herfindahl, 0 à 1) par éditeur
const concentration = copies => {
  const r = rowsOf(copies).filter(x => x.value !== null && x.value > 0), total = r.reduce((a, x) => a + x.value, 0);
  if (!total) return { n: 0, total: 0, top10Pct: null, hhi: null, topPublisher: null, top: [] };
  const sorted = r.slice().sort((a, b) => b.value - a.value), top = sorted.slice(0, 10), topSum = top.reduce((a, x) => a + x.value, 0);
  const pubs = new Map(); r.forEach(x => pubs.set(pubOf(x.c), (pubs.get(pubOf(x.c)) || 0) + x.value));
  const shares = [...pubs.entries()].map(([name, v]) => ({ name, pct: v / total * 100 })).sort((a, b) => b.pct - a.pct);
  const hhi = shares.reduce((a, s) => a + (s.pct / 100) ** 2, 0);
  return { n: r.length, total, top10Pct: Math.round(topSum / total * 1000) / 10, hhi: Math.round(hhi * 100) / 100, topPublisher: shares[0], top: top.slice(0, 5).map(x => ({ label: label(x.c), value: x.value })) };
};

// Rendement par éditeur : seuls les exemplaires avec prix payé ET cote comptent
const roiByPublisher = copies => {
  const m = new Map();
  rowsOf(copies).forEach(x => { if (x.paid === null || x.value === null) return; const k = pubOf(x.c), p = m.get(k) || { name: k, n: 0, paid: 0, value: 0 }; p.n++; p.paid += x.paid; p.value += x.value; m.set(k, p); });
  return [...m.values()].map(p => ({ ...p, gain: p.value - p.paid, roi: p.paid ? Math.round((p.value - p.paid) / p.paid * 1000) / 10 : null })).sort((a, b) => (b.roi ?? -1e9) - (a.roi ?? -1e9));
};

// Key Issues : nombre, valeur, rendement
const keys = copies => {
  const all = rowsOf(copies), k = all.filter(x => String(x.c.keyType || '').trim());
  const val = k.reduce((a, x) => a + (x.value || 0), 0), totalVal = all.reduce((a, x) => a + (x.value || 0), 0);
  const both = k.filter(x => x.paid !== null && x.value !== null), paid = both.reduce((a, x) => a + x.paid, 0), bv = both.reduce((a, x) => a + x.value, 0);
  return { n: k.length, sharePct: all.length ? Math.round(k.length / all.length * 1000) / 10 : 0, value: val, valuePct: totalVal ? Math.round(val / totalVal * 1000) / 10 : null, roi: paid ? Math.round((bv - paid) / paid * 1000) / 10 : null };
};

// Gradés et variantes
const grading = copies => {
  const all = rowsOf(copies), n = all.length || 1;
  const g = all.filter(x => GRADED.test(String(x.c.condition || ''))), v = all.filter(x => String(x.c.variant || '').trim());
  const avg = a => { const w = a.filter(x => x.value !== null); return w.length ? w.reduce((s, x) => s + x.value, 0) / w.length : null; };
  return { graded: g.length, gradedPct: Math.round(g.length / n * 1000) / 10, variants: v.length, variantPct: Math.round(v.length / n * 1000) / 10, avgGraded: avg(g), avgRaw: avg(all.filter(x => !GRADED.test(String(x.c.condition || '')))) };
};

// Rythme d'achat sur 12 mois, comparé aux 12 mois précédents
const pace = (copies, now) => {
  const d0 = now instanceof Date ? now : new Date(now || Date.now()), months = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(d0.getFullYear(), d0.getMonth() - i, 1); months.push({ month: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), n: 0, spent: 0 }); }
  const prevStart = new Date(d0.getFullYear(), d0.getMonth() - 23, 1), prevEnd = new Date(d0.getFullYear(), d0.getMonth() - 11, 1);
  let prev = 0;
  rowsOf(copies).forEach(x => {
    const m = months.find(y => y.month === monthOf(x.date)); if (m) { m.n++; m.spent += x.paid || 0; return; }
    const mo = monthOf(x.date); if (!mo) return; const t = new Date(Number(mo.slice(0, 4)), Number(mo.slice(5)) - 1, 1);
    if (t >= prevStart && t < prevEnd) prev++;
  });
  const cur = months.reduce((a, m) => a + m.n, 0);
  return { months, total: cur, perMonth: Math.round(cur / 12 * 10) / 10, previous: prev, trendPct: prev ? Math.round((cur - prev) / prev * 1000) / 10 : null, busiest: months.reduce((b, m) => (m.n > (b ? b.n : 0) ? m : b), null) };
};

// Durée de détention (en mois) à partir de la date d'achat, sinon d'ajout
const hold = (copies, now) => {
  const t0 = (now instanceof Date ? now : new Date(now || Date.now())).getTime();
  const r = rowsOf(copies).map(x => ({ x, t: Date.parse(String(x.date).slice(0, 10)) })).filter(y => Number.isFinite(y.t) && y.t <= t0).map(y => ({ c: y.x.c, months: Math.floor((t0 - y.t) / (30.44 * 864e5)) }));
  if (!r.length) return { n: 0, avgMonths: null, oldest: [] };
  return { n: r.length, avgMonths: Math.round(r.reduce((a, y) => a + y.months, 0) / r.length), oldest: r.sort((a, b) => b.months - a.months).slice(0, 3).map(y => ({ label: label(y.c), months: y.months })) };
};

// Tout en une fois, avec le nombre d'exemplaires sans cote (transparence)
const advanced = (copies, now) => {
  const r = rowsOf(copies);
  return { count: r.length, unvalued: r.filter(x => x.value === null).length, concentration: concentration(copies), roi: roiByPublisher(copies), keys: keys(copies), grading: grading(copies), pace: pace(copies, now), hold: hold(copies, now) };
};

module.exports = { FREE, PLUS, gate, concentration, roiByPublisher, keys, grading, pace, hold, advanced };
