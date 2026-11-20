'use strict';
// Idées originales du virage social (lot S7, D-95) : Mercredi des sorties, Duel de couvertures, Chasse aux variantes,
// Carte de collectionneur. Module pur : l'appelant fournit les vraies données (pull list, collection, Wishlist, profil public) ;
// rien n'est inventé, aucun vote ni aucune réponse d'autrui n'est simulé, aucun chiffre financier ne sort.

const VERSION = 1;
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const str = (v, max) => String(v === undefined || v === null ? '' : v).trim().slice(0, max);
const norm = t => str(t, 200).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^#\s*/, '').replace(/\s+/g, ' ');
const issueKey = c => norm(c && c.series) + '|' + norm(c && c.issue).replace(/^0+(?=\d)/, '');
const safeCover = u => { const s = str(u, 4000); return /^https:\/\//i.test(s) || /^data:image\/(png|jpeg|webp|gif);/i.test(s) ? s : ''; };
// Seuls ces champs d'un numéro peuvent apparaître dans un duel, une chasse ou une carte (jamais prix, valeur, emplacement, note, état)
const light = c => ({ series: str(c && c.series, 200), issue: str(c && c.issue, 20), publisher: str(c && c.publisher, 100), variant: str(c && c.variant, 120), coverUrl: safeCover(c && c.coverUrl) });

// ── Mercredi des sorties : la semaine (lundi à dimanche) et son mercredi, jour de sortie des comics en boutique
const isoOf = d => d.toISOString().slice(0, 10);
const wednesdayOf = day => {
  if (!ISO.test(String(day || ''))) return '';
  const d = new Date(day + 'T12:00:00Z');
  const dow = (d.getUTCDay() + 6) % 7; // lundi = 0
  d.setUTCDate(d.getUTCDate() - dow + 2);
  return isoOf(d);
};
// items : [{ id, series, issue, variant, publisher, cover, day, pulled, status }] (publications datées de la pull list et des sorties)
const releaseWeek = ({ items = [], today = '' } = {}) => {
  const wed = wednesdayOf(today);
  const out = { wednesday: wed, isWednesday: !!wed && wed === today, pulled: [], others: [] };
  if (!wed) return out;
  const seen = new Set();
  for (const it of items || []) {
    if (!it || it.status === 'cancelled' || it.cancelled === true || wednesdayOf(it.day) !== wed) continue;
    const k = issueKey(it) + '|' + norm(it.variant);
    if (seen.has(k)) continue;
    seen.add(k);
    const rec = Object.assign({ id: str(it.id, 80), day: it.day }, light({ series: it.series, issue: it.issue, publisher: it.publisher, variant: it.variant, coverUrl: it.cover || it.coverUrl }));
    (it.pulled ? out.pulled : out.others).push(rec);
  }
  const by = (a, b) => a.series.localeCompare(b.series, 'fr') || a.issue.localeCompare(b.issue, 'fr', { numeric: true });
  out.pulled.sort(by); out.others.sort(by);
  return out;
};
const wednesdayTopics = week => (week.pulled.length ? week.pulled : week.others).slice(0, 8).map(x => [x.series, x.issue ? '#' + x.issue.replace(/^#/, '') : ''].filter(Boolean).join(' ') + (x.variant && !/^cover a$/i.test(x.variant) ? ' (' + x.variant + ')' : ''));

// ── Duel de couvertures : deux variantes du même numéro, chacune avec sa couverture
const duelCandidates = (copies = []) => {
  const groups = new Map();
  for (const c of copies || []) {
    if (!c || !c.series || !safeCover(c.coverUrl)) continue;
    const k = issueKey(c);
    const g = groups.get(k) || [];
    if (!g.some(x => norm(x.variant) === norm(c.variant) || x.coverUrl === c.coverUrl)) g.push(c);
    groups.set(k, g);
  }
  return [...groups.values()].filter(g => g.length >= 2)
    .map(g => ({ series: str(g[0].series, 200), issue: str(g[0].issue, 20), options: g.slice(0, 6) }))
    .sort((a, b) => b.options.length - a.options.length || a.series.localeCompare(b.series, 'fr'));
};
const duelText = (a, b) => 'Duel de couvertures : ' + [a.series, a.issue ? '#' + String(a.issue).replace(/^#/, '') : ''].filter(Boolean).join(' ') + '. ' + (a.variant || 'Couverture A') + ' ou ' + (b.variant || 'Couverture B') + ' ?';
// Votes : un seul par duel et par personne ; tant que les comptes ne sont pas actifs, seul votre vote existe (rien n'est simulé)
const VOTE_ID = /^[A-Za-z0-9_-]{1,80}$/;
const emptyVotes = () => ({ version: VERSION, votes: {} });
const sanitizeVotes = v => {
  const o = emptyVotes();
  if (!v || typeof v !== 'object' || !v.votes || typeof v.votes !== 'object') return o;
  for (const [id, x] of Object.entries(v.votes).slice(0, 2000)) if (VOTE_ID.test(id) && x && (x.side === 0 || x.side === 1) && !isNaN(Date.parse(x.at))) o.votes[id] = { side: x.side, at: x.at };
  return o;
};
// Même côté : le vote est retiré ; autre côté : il change. Renvoie un nouvel état.
const vote = (state, duelId, side, now) => {
  const s = sanitizeVotes(JSON.parse(JSON.stringify(state || {})));
  if (!VOTE_ID.test(String(duelId)) || (side !== 0 && side !== 1)) return { state: s, side: null, error: 'invalid' };
  if (s.votes[duelId] && s.votes[duelId].side === side) { delete s.votes[duelId]; return { state: s, side: null }; }
  s.votes[duelId] = { side, at: new Date(now || Date.now()).toISOString() };
  return { state: s, side };
};
const myVote = (state, duelId) => { const x = sanitizeVotes(state).votes[duelId]; return x ? x.side : null; };

// ── Chasse aux variantes : une variante cherchée (depuis la Wishlist) ; le prix visé n'est jamais publié
const huntItem = wish => {
  const w = (wish && wish.wish) || {};
  return light({ series: wish && wish.series, issue: wish && wish.issue, publisher: wish && wish.publisher, variant: str(w.variantWanted, 120) || (wish && wish.variant), coverUrl: wish && wish.coverUrl });
};
const huntText = it => 'Je cherche ' + [it.series, it.issue ? '#' + String(it.issue).replace(/^#/, '') : ''].filter(Boolean).join(' ') + (it.variant ? ' (' + it.variant + ')' : '') + '. Quelqu\'un l\'a ?';
const huntCandidates = (wishlist = []) => (wishlist || []).filter(w => w && w.series && !['found', 'abandoned'].includes(((w.wish || {}).status) || ''))
  .sort((a, b) => (((b.wish || {}).priority === 'high') - ((a.wish || {}).priority === 'high')) || !!(b.wish || {}).variantWanted - !!(a.wish || {}).variantWanted || String(b.addedAt || '').localeCompare(String(a.addedAt || '')));
// La chasse est trouvée dès qu'un exemplaire possédé correspond (même numéro, même variante quand elle est précisée)
const huntFound = (it, copies = []) => (copies || []).some(c => c && issueKey(c) === issueKey(it) && (!it.variant || norm(c.variant) === norm(it.variant)));

// ── Carte de collectionneur : uniquement des éléments du profil public (S5) et des chiffres non financiers
const cardModel = ({ view = {}, favorite = null } = {}) => {
  const pr = view.profile || null;
  const facts = [];
  if (view.counts) { facts.push({ n: Number(view.counts.copies) || 0, label: 'numéros' }); facts.push({ n: Number(view.counts.series) || 0, label: 'séries' }); }
  if (typeof view.read === 'number') facts.push({ n: view.read, label: 'lus' });
  if (view.rank && typeof view.rank.trophies === 'number') facts.push({ n: view.rank.trophies, label: 'trophées' });
  return {
    name: pr ? str(pr.displayName || pr.handle, 40) : 'Collectionneur Panel',
    handle: pr ? str(pr.handle, 24) : '',
    color: pr && /^#[0-9a-f]{6}$/i.test(pr.color || '') ? pr.color : '#7C5CFF',
    favoriteCharacter: pr ? str(pr.favorite, 60) : '',
    rank: view.rank ? { rank: Number(view.rank.rank) || 0, name: str(view.rank.name, 60) } : null,
    facts: facts.slice(0, 4),
    favorite: favorite ? light(favorite) : null
  };
};

module.exports = { VERSION, wednesdayOf, releaseWeek, wednesdayTopics, duelCandidates, duelText, emptyVotes, sanitizeVotes, vote, myVote, huntItem, huntText, huntCandidates, huntFound, cardModel, light };
