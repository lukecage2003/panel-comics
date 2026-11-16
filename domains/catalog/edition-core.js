'use strict';
// Edition Intelligence (PANEL 2.0, module 02, D-81) — module autonome : ni réseau, ni stockage, ni accès aux autres domaines.
// Rôle : distinguer, pour une fiche de publication, quatre niveaux qu'on confond souvent :
//  - œuvre : l'histoire, indépendante de la langue et du format (clé = titre normalisé, sans année ni volume) ;
//  - publication : la parution précise (série, numéro ou tome, marché) ;
//  - édition : la forme matérielle (format, langue, éditeur, ISBN/UPC) ;
//  - exemplaire : l'objet que VOUS possédez (compté par la collection, jamais déduit ici).
// Et qualifier les correspondances entre éditions (VO / VF, recueils, rééditions) :
//  - « établie » : relation enregistrée par l'utilisateur (choix explicite), avec sa preuve éventuelle ;
//  - « probable » : simple suggestion calculée, toujours accompagnée de ses raisons, jamais enregistrée seule.
// Une suggestion n'est jamais présentée comme établie, quel que soit son score.

const LEVELS = Object.freeze({
  work: { label: 'Œuvre', hint: 'L\'histoire elle-même, quelle que soit la langue ou le format.' },
  publication: { label: 'Publication', hint: 'Cette parution précise : série, numéro ou tome, marché.' },
  edition: { label: 'Édition', hint: 'La forme matérielle : format, langue, éditeur, identifiants.' },
  copy: { label: 'Exemplaire', hint: 'L\'objet que vous possédez, compté dans votre collection.' }
});
const CERTAINTY = Object.freeze({ established: 'Établie', probable: 'Probable' });
const STOP = new Set(['the', 'les', 'des', 'tome', 'vol', 'volume', 'and', 'et']);

const str = v => (v === undefined || v === null ? '' : String(v)).trim();
const norm = s => str(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
// Clé d'œuvre : titre sans année « (2016) », sans « Vol. 2 » ni mots vides
const workKey = series => norm(str(series).replace(/\(\s*\d{4}\s*\)/g, ' ').replace(/\bvol(ume)?\.?\s*\d+\b/gi, ' '))
  .split(' ').filter(w => w && !STOP.has(w)).join(' ');
const tokens = series => new Set(workKey(series).split(' ').filter(w => w.length > 2));

function levels(pub, copy) {
  const p = pub || {};
  const ids = Object.entries(p.externalIds || {}).filter(([, v]) => str(v)).map(([k, v]) => k.toUpperCase() + ' ' + str(v));
  const own = copy || null;
  return [
    { level: 'work', label: LEVELS.work.label, hint: LEVELS.work.hint, value: workKey(p.series) ? str(p.series).replace(/\(\s*\d{4}\s*\)/g, '').trim() : '—', key: workKey(p.series) },
    { level: 'publication', label: LEVELS.publication.label, hint: LEVELS.publication.hint,
      value: [str(p.series), str(p.issue) ? '#' + str(p.issue).replace(/^#/, '') : '', str(p.market) ? '(' + str(p.market) + ')' : ''].filter(Boolean).join(' ') || '—' },
    { level: 'edition', label: LEVELS.edition.label, hint: LEVELS.edition.hint,
      value: [str(p.formatLabel || p.format), str(p.language), str(p.publisher)].filter(Boolean).concat(ids).join(' · ') || '—' },
    { level: 'copy', label: LEVELS.copy.label, hint: LEVELS.copy.hint,
      value: own && own.owned > 0 ? own.owned + ' dans votre collection' + (own.unconfirmed ? ' (+ à confirmer)' : '') : 'Aucun exemplaire dans votre collection' }
  ];
}

// Relation enregistrée : toujours établie (choix explicite de l'utilisateur)
function established(rel) {
  const r = rel || {};
  return { certainty: 'established', label: CERTAINTY.established, reasons: ['Relation choisie par vous' + (r.evidence ? ' · preuve : ' + str(r.evidence).slice(0, 120) : '')] };
}

// Suggestion : probable au mieux, avec les raisons qui la justifient (jamais « établie »)
function probable(pub, other) {
  const p = pub || {}, q = other || {};
  const a = tokens(p.series), b = tokens(q.series);
  if (!a.size || !b.size) return null;
  const inter = [...a].filter(w => b.has(w)).length;
  const score = inter / Math.max(a.size, b.size);
  if (score < 0.5) return null;
  const reasons = [score === 1 ? 'Même titre d\'œuvre' : 'Titre proche (' + Math.round(score * 100) + ' %)'];
  if (str(p.market) && str(q.market) && p.market !== q.market) reasons.push('Autre marché (' + q.market + ')');
  if (str(p.language) && str(q.language) && norm(p.language) !== norm(q.language)) reasons.push('Autre langue (' + q.language + ')');
  const ni = s => str(s).replace(/^#/, '').replace(/^0+(?=\d)/, '');
  if (ni(p.issue) && ni(p.issue) === ni(q.issue)) reasons.push('Même numéro ou tome');
  if (str(p.format) && str(q.format) && p.format !== q.format) reasons.push('Format différent : recueil possible, contenu à vérifier');
  return { certainty: 'probable', label: CERTAINTY.probable, score: Math.round(score * 100) / 100, reasons, note: 'À vérifier : rien n\'est relié sans votre choix.' };
}

// Correspondances d'une publication : établies d'abord, puis probables (sans doublon avec une établie)
function correspondences(pub, relations, candidates) {
  const linked = new Set();
  const out = (relations || []).map(r => { linked.add(r.otherId); return Object.assign({ otherId: r.otherId, type: r.type }, established(r)); });
  (candidates || []).forEach(q => {
    if (!q || !q.id || q.id === (pub || {}).id || linked.has(q.id)) return;
    const pr = probable(pub, q);
    if (pr) out.push(Object.assign({ otherId: q.id }, pr));
  });
  return out;
}

module.exports = { LEVELS, CERTAINTY, workKey, levels, established, probable, correspondences };
