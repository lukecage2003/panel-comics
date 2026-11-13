'use strict';
// Statistiques de collection (PRD V1 : COL-09 répartition par période, COL-11 historique des acquisitions).
// Module pur : reçoit des exemplaires déjà filtrés (possédés), ne lit ni n'écrit aucun stockage. Aucune valeur inventée :
// une date inconnue est comptée à part, jamais rattachée à une période.

const yearOf = v => {
  if (v === null || v === undefined || v === '') return null;
  const m = /^(\d{4})/.exec(String(v).trim());
  if (!m) return null;
  const y = Number(m[1]);
  return y >= 1900 && y <= 2100 ? y : null;
};

// Année de publication d'un exemplaire : année de couverture, sinon date de couverture, sinon date de sortie
const publicationYear = c => c ? (yearOf(c.coverYear) || yearOf(c.coverDate) || yearOf(c.releaseDate)) : null;
// Année d'acquisition : date d'achat, sinon date d'ajout dans Panel (signalée par `approx`)
const acquisitionDate = c => {
  if (!c) return null;
  if (yearOf(c.purchaseDate)) return { date: String(c.purchaseDate).slice(0, 10), approx: false };
  if (yearOf(c.addedAt)) return { date: String(c.addedAt).slice(0, 10), approx: true };
  return null;
};

// Répartition par décennie de publication (ordre chronologique) ; `unknown` = sans année
const byDecade = copies => {
  const m = new Map(); let unknown = 0;
  (copies || []).forEach(c => { const y = publicationYear(c); if (!y) { unknown++; return; } const d = Math.floor(y / 10) * 10; m.set(d, (m.get(d) || 0) + 1); });
  const rows = [...m.entries()].sort((a, b) => a[0] - b[0]).map(([decade, n]) => ({ decade, label: decade + 's', n }));
  return { rows, unknown, total: (copies || []).length };
};

// Historique des acquisitions par année (ordre chronologique) ; `approx` = années déduites de la date d'ajout
const acquisitionsByYear = copies => {
  const m = new Map(); let unknown = 0;
  (copies || []).forEach(c => {
    const a = acquisitionDate(c);
    if (!a) { unknown++; return; }
    const y = Number(a.date.slice(0, 4));
    const r = m.get(y) || { year: y, n: 0, approx: 0 };
    r.n++; if (a.approx) r.approx++;
    m.set(y, r);
  });
  return { rows: [...m.values()].sort((a, b) => a.year - b.year), unknown, total: (copies || []).length };
};

module.exports = { yearOf, publicationYear, acquisitionDate, byDecade, acquisitionsByYear };
