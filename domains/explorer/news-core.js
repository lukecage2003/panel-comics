'use strict';
// Actualités (D-75) : rubriques, classement et apprentissage local des préférences de lecture.
//  - Les rubriques sont déduites du titre, de l'extrait et des catégories du flux (mots-clés français et anglais).
//  - Le classement mêle fraîcheur, intérêts déclarés (suivis, collection) et préférences apprises sur l'appareil :
//    chaque article ouvert renforce ses rubriques et sa source ; les poids s'estompent de moitié en 30 jours.
//  - Module pur : rien n'est envoyé ; l'appelant stocke l'état d'apprentissage (localStorage).

const TOPICS = Object.freeze({
  marvel: { label: 'Marvel', re: /\b(marvel|avengers?|x-?men|spider-?(man|verse|woman|gwen)|iron ?man|captain america|thor|hulk|wolverine|deadpool|daredevil|venom|fantastic four|4 fantastiques|thunderbolts|doctor (doom|strange)|docteur strange|black panther|loki|punisher|moon knight|guardians of the galaxy|gardiens de la galaxie|eternals|blade|silver surfer|galactus|thanos)\b/i },
  dc: { label: 'DC', re: /\b(dc( comics| studios| universe)?|batman|superman|wonder woman|justice league|joker|gotham|aquaman|the flash|green lantern|lanterns|supergirl|harley quinn|peacemaker|clayface|catwoman|nightwing|robin|darkseid|absolute (batman|superman|wonder woman))\b/i },
  bd: { label: 'BD', re: /\b(bd|bande[s]? dessin[ée]e?s?|franco-belge|ast[ée]rix|tintin|spirou|lucky luke|blake (et|&) mortimer|angoul[êe]me|dupuis|dargaud|casterman|glénat|delcourt|lombard|futuropolis|soleil)\b/i },
  manga: { label: 'Manga', re: /\b(manga|mangas|anime|shonen|shōnen|seinen|one piece|naruto|dragon ball|jujutsu|chainsaw man|my hero academia|ki-oon|kana|pika|kurokawa)\b/i },
  indie: { label: 'Indé', re: /\b(image comics|boom! studios|boom studios|dark horse|idw|dynamite|skybound|invincible|the walking dead|saga|spawn|hellboy|energon|transformers|tmnt|ninja turtles|mad cave|oni press|awa studios)\b/i },
  ecran: { label: 'Films & séries', re: /\b(film|films|movie|movies|s[ée]rie|series|season|saison|trailer|bande-annonce|teaser|box[- ]office|casting|cast|disney\+|netflix|hbo|prime video|cin[ée]ma|réalisateur|director|tournage|sortie en salles|in theaters|post-credits?|sc[èe]ne post-g[ée]n[ée]rique)\b/i },
  sorties: { label: 'Sorties', re: /\b(sortie|sorties|parution|nouveaut[ée]s?|new comics|release[sd]?|on sale|solicitations?|preview|pr[ée]commande|foc|final order cutoff|first look|premier regard|annonce|announced?)\b/i },
  evenements: { label: 'Festivals', re: /\b(festival|convention|comic-?con|nycc|sdcc|salon|expo|dédicace|dedicace|prix|award|eisner|fauve)\b/i }
});
const TOPIC_KEYS = Object.freeze(Object.keys(TOPICS));
const HALF_LIFE_DAYS = 30;

const norm = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const text = a => [a && a.title, a && a.excerpt, ...((a && a.categories) || [])].filter(Boolean).join(' ');

// Rubriques d'un article (au moins « comics » quand rien d'autre n'est reconnu)
const classify = a => {
  const t = text(a), out = [];
  for (const k of TOPIC_KEYS) if (TOPICS[k].re.test(t) || TOPICS[k].re.test(norm(t))) out.push(k);
  if (!out.some(k => k !== 'sorties' && k !== 'evenements' && k !== 'ecran')) out.push('comics');
  return out;
};

const emptyLearn = () => ({ version: 1, topics: {}, sources: {}, at: null, clicks: 0 });
const sanitizeLearn = v => {
  const o = emptyLearn();
  if (!v || typeof v !== 'object') return o;
  const clean = m => { const r = {}; if (m && typeof m === 'object') for (const [k, x] of Object.entries(m).slice(0, 80)) { const n = Number(x); if (/^[a-z0-9_-]{1,40}$/i.test(k) && isFinite(n) && n > 0) r[k] = Math.min(n, 50); } return r; };
  o.topics = clean(v.topics); o.sources = clean(v.sources);
  o.at = typeof v.at === 'string' && !isNaN(new Date(v.at)) ? v.at : null;
  o.clicks = Math.max(0, Math.min(1e6, Number(v.clicks) || 0));
  return o;
};
// Les poids s'estompent : un intérêt ancien compte de moins en moins
const decay = (learn, now) => {
  const l = sanitizeLearn(learn);
  if (!l.at) return l;
  const days = Math.max(0, (new Date(now).getTime() - new Date(l.at).getTime()) / 86400000);
  const f = Math.pow(0.5, days / HALF_LIFE_DAYS);
  for (const m of [l.topics, l.sources]) for (const k of Object.keys(m)) { m[k] = +(m[k] * f).toFixed(4); if (m[k] < 0.05) delete m[k]; }
  return l;
};
// Un article ouvert : ses rubriques (+1) et sa source (+0,5) gagnent du poids
const learnFrom = (learn, article, now) => {
  const l = decay(learn, now);
  for (const k of classify(article)) l.topics[k] = Math.min(50, (l.topics[k] || 0) + 1);
  if (article && article.sourceId && /^[a-z0-9_-]{1,40}$/i.test(article.sourceId)) l.sources[article.sourceId] = Math.min(50, (l.sources[article.sourceId] || 0) + 0.5);
  l.at = new Date(now).toISOString(); l.clicks++;
  return l;
};
// Classement : fraîcheur (demi-vie 2 jours) + intérêt déclaré + préférences apprises ; explication jointe
const rank = (items, opts = {}) => {
  const now = new Date(opts.now || Date.now()).getTime();
  const l = decay(opts.learn, now);
  const tot = Object.values(l.topics).reduce((s, x) => s + x, 0) || 1;
  const interests = opts.interests || [];
  return (items || []).map((a, i) => {
    const topics = classify(a);
    const age = a.date ? Math.max(0, (now - new Date(a.date).getTime()) / 3600000) : 240;
    const fresh = Math.pow(0.5, age / 48);
    const t = ' ' + norm(text(a)) + ' ';
    const why = interests.find(([n]) => n && t.includes(' ' + n + ' '));
    const learned = topics.reduce((s, k) => s + (l.topics[k] || 0) / tot, 0);
    const best = topics.slice().sort((x, y) => (l.topics[y] || 0) - (l.topics[x] || 0))[0];
    const score = fresh * 3 + (why ? 2.5 : 0) + learned * 2 + Math.min(1, (l.sources[a.sourceId] || 0) / 5) * 0.5 + (a.image ? 0.15 : 0);
    return { a, topics, score, why: why ? why[1] : '', learnedTopic: !why && learned > 0.25 && l.clicks >= 3 && best ? TOPICS[best] ? TOPICS[best].label : 'Comics' : '', i };
  }).sort((x, y) => y.score - x.score || x.i - y.i);
};
const topicLabel = k => k === 'comics' ? 'Comics' : TOPICS[k] ? TOPICS[k].label : '';

module.exports = { TOPICS, TOPIC_KEYS, HALF_LIFE_DAYS, classify, emptyLearn, sanitizeLearn, decay, learnFrom, rank, topicLabel };
