'use strict';
// Vues du calendrier des sorties (PRD V1 : REL-06 Upcoming #1 et FOC, REL-07 variantes regroupées).
// Module pur : travaille sur des publications déjà chargées, n'écrit rien. La FOC n'est affichée que si une source la fournit.

const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const issueNum = v => { const m = /-?\d+(?:\.\d+)?/.exec(String(v || '').replace(',', '.')); return m ? Number(m[0]) : null; };
const seriesKey = p => [norm(p.series), norm(p.publisher), p.market || ''].join('|');
const issueKey = p => [seriesKey(p), String(p.issue || '').trim().replace(/^#/, '').toLowerCase(), p.format || ''].join('|');

// Date de bouclage des commandes (FOC) : uniquement si elle est connue
const focOf = p => {
  if (!p) return null;
  const d = (p.dates && p.dates.foc) || p.focDate || null;
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : null;
};

// Nouveau #1 à venir : numéro 1 (ou 0), date future ou du jour, sans numéro antérieur connu de la même série
const isUpcomingFirst = (p, all, today) => {
  if (!p || !p.dates || !p.dates.current || p.dates.current < today || p.cancelled) return false;
  const n = issueNum(p.issue);
  if (n !== 1 && n !== 0) return false;
  const k = seriesKey(p);
  return !(all || []).some(o => o !== p && seriesKey(o) === k && issueNum(o.issue) !== null && issueNum(o.issue) < n && o.dates && o.dates.current && o.dates.current < p.dates.current);
};
const upcomingFirsts = (items, all, today) => (items || []).filter(p => isUpcomingFirst(p, all || items, today));

// Regroupe les variantes d'un même numéro : la couverture principale (sans variante ou « Cover A ») en tête
const isMainCover = p => !p.variant || /^(cover\s*a|couverture\s*a|regular|standard)$/i.test(String(p.variant).trim());
const groupVariants = items => {
  const groups = new Map();
  (items || []).forEach(p => { const k = issueKey(p); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); });
  return [...groups.values()].map(list => {
    const main = list.find(isMainCover) || list[0];
    return { main, variants: list.filter(x => x !== main) };
  });
};

// Rappel local (NOT-04) : numéros suivis qui sortent dans les `days` prochains jours ; un seul rappel par jour (`lastDay`)
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const reminderDigest = (pulled, today, lastDay, days = 7) => {
  if (lastDay === today) return null;
  const end = addDays(today, days);
  const due = (pulled || []).filter(p => p && !p.cancelled && p.dates && p.dates.current && p.dates.current >= today && p.dates.current <= end)
    .sort((a, b) => a.dates.current.localeCompare(b.dates.current));
  if (!due.length) return null;
  const label = p => [p.series, p.issue ? '#' + String(p.issue).replace(/^#/, '') : ''].filter(Boolean).join(' ');
  return { count: due.length, title: due.length === 1 ? 'Sortie à venir dans votre pull list' : due.length + ' sorties à venir dans votre pull list',
    body: due.slice(0, 5).map(label).join(', ') + (due.length > 5 ? '…' : ''), ids: due.map(p => p.id) };
};

module.exports = { norm, issueNum, seriesKey, issueKey, focOf, isUpcomingFirst, upcomingFirsts, isMainCover, groupVariants, addDays, reminderDigest };
