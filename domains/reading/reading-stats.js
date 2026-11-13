'use strict';
// Statistiques de lecture (PRD V1 : RDG-06, RDG-07). Module pur, calculé sur le journal de lecture (domaine Lecture, L1) :
// événements `finished` (première lecture) et `reread` (relecture), datés. Rien n'est stocké ; aucune lecture n'est inventée.

const READ_EVENTS = ['finished', 'reread'];

// 12 mois glissants se terminant au mois de `now` (clé AAAA-MM)
const lastMonths = (now, count = 12) => {
  const d = new Date(now), out = [];
  for (let i = count - 1; i >= 0; i--) { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)); out.push(x.toISOString().slice(0, 7)); }
  return out;
};

// Lectures par mois (12 derniers mois) et totaux de l'année civile de `now`
const readingStats = (log, now = new Date().toISOString(), opts = {}) => {
  const countRereads = opts.countRereads !== false;
  const months = lastMonths(now);
  const perMonth = Object.fromEntries(months.map(m => [m, 0]));
  const year = String(now).slice(0, 4);
  let yearFirst = 0, yearRereads = 0;
  const works = new Set();
  (log || []).forEach(l => {
    if (!l || !READ_EVENTS.includes(l.event) || typeof l.at !== 'string') return;
    const m = l.at.slice(0, 7);
    const counts = l.event === 'finished' || countRereads;
    if (counts && m in perMonth) perMonth[m]++;
    if (l.at.slice(0, 4) === year) { if (l.event === 'finished') { yearFirst++; works.add(l.workKey); } else yearRereads++; }
  });
  return { months: months.map(m => ({ month: m, n: perMonth[m] })), year: Number(year), yearFirst, yearRereads, yearWorks: works.size };
};

// Avancement d'un objectif annuel (nombre de premières lectures) ; null si aucun objectif valide
const goalProgress = (stats, goal) => {
  const g = Math.floor(Number(goal));
  if (!stats || !Number.isFinite(g) || g <= 0) return null;
  return { goal: g, done: stats.yearFirst, pct: Math.min(100, Math.round(stats.yearFirst / g * 100)) };
};

module.exports = { READ_EVENTS, lastMonths, readingStats, goalProgress };
