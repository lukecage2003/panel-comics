'use strict';
// Langues de l'interface (D-103) : module pur. Le français reste la langue source de Panel ;
// les autres langues sont des tables « phrase française -> traduction », appliquées à l'affichage.
// Règles :
//   - une phrase sans traduction reste en français (jamais de texte vide ni de clé technique affichée) ;
//   - les nombres d'une phrase sont repérés et remis à leur place : la table contient « {n} numéros », pas chaque nombre ;
//   - dates et nombres passent par Intl avec la locale de la langue choisie ;
//   - le contenu des utilisateurs (titres, notes, pensées) n'est jamais traduit : seules les phrases connues de l'interface le sont.

const LOCALES = Object.freeze({ fr: 'Français', en: 'English', es: 'Español', pt: 'Português' });
const INTL = Object.freeze({ fr: 'fr-FR', en: 'en-US', es: 'es-ES', pt: 'pt-BR' });
const RTL = Object.freeze([]); // écriture de droite à gauche : aucune langue pour l'instant (prévu)

// Langue à utiliser : le choix enregistré, sinon « auto » d'après le navigateur, sinon le français
const resolveLocale = (pref, navLangs) => {
  const p = String(pref || '').toLowerCase();
  if (LOCALES[p]) return p;
  if (p === 'auto') {
    for (const l of (Array.isArray(navLangs) ? navLangs : [navLangs])) { const k = String(l || '').toLowerCase().slice(0, 2); if (LOCALES[k]) return k; }
  }
  return 'fr';
};
const intlLocale = loc => INTL[loc] || INTL.fr;
const dir = loc => RTL.includes(loc) ? 'rtl' : 'ltr';

const NUM = /\d[\d   .,]*\d|\d/g;
const norm = s => String(s == null ? '' : s).replace(/[\s  ]+/g, ' ').trim();
// Gabarit d'une phrase : ses nombres remplacés par {n}
const template = s => { const nums = []; const t = norm(s).replace(NUM, m => { nums.push(m); return '{n}'; }); return { t, nums }; };

// Traducteur d'une langue : texte -> traduction (espaces de début et de fin conservés), ou null s'il n'y en a pas
const translator = (loc, dict) => {
  if (!dict || loc === 'fr' || !LOCALES[loc]) return () => null;
  const phrases = dict.phrases || dict;
  const map = new Map();
  Object.keys(phrases).forEach(k => { const v = phrases[k]; if (typeof v === 'string' && v) map.set(norm(k), v); });
  // Noms propres et mots identiques dans cette langue (personnages, créateurs, éditeurs) : conservés tels quels
  (Array.isArray(dict.same) ? dict.same : []).forEach(k => { const n = norm(k); if (n && !map.has(n)) map.set(n, n); });
  return text => {
    const raw = String(text == null ? '' : text), n = norm(raw);
    if (!n) return null;
    const lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
    let out = map.get(n);
    if (out === undefined && /\d/.test(n)) {
      const { t, nums } = template(n), hit = map.get(t);
      if (hit !== undefined) { let i = 0; out = hit.replace(/\{n\}/g, () => (nums[i++] !== undefined ? nums[i - 1] : '')); }
    }
    return out === undefined ? null : lead + out + trail;
  };
};

// Couverture d'une table sur une liste de phrases relevées
const coverage = (strings, loc, dict) => {
  const tr = translator(loc, dict), list = (Array.isArray(strings) ? strings : []).map(norm).filter(Boolean);
  const missing = list.filter(s => tr(s) === null);
  return { total: list.length, translated: list.length - missing.length, missing };
};

// Une table est-elle saine ? Pas de traduction vide, mêmes {n} des deux côtés, pas de balise
const checkDict = dict => {
  const errors = [], phrases = (dict && dict.phrases) || {};
  Object.keys(phrases).forEach(k => {
    const v = phrases[k];
    if (typeof v !== 'string' || !v.trim()) errors.push('vide : ' + k);
    else {
      const a = (k.match(/\{n\}/g) || []).length, b = (v.match(/\{n\}/g) || []).length;
      if (a !== b) errors.push('{n} différents : ' + k);
      if (/<[a-z/!]/i.test(v)) errors.push('balise : ' + k);
    }
  });
  return errors;
};

const fmtNumber = (n, loc, opts) => { try { return new Intl.NumberFormat(intlLocale(loc), opts).format(n); } catch (_) { return String(n); } };
const fmtDate = (d, loc, opts) => { try { const x = d instanceof Date ? d : new Date(d); return Number.isNaN(x.getTime()) ? '' : x.toLocaleDateString(intlLocale(loc), opts); } catch (_) { return ''; } };

module.exports = { LOCALES, INTL, RTL, resolveLocale, intlLocale, dir, norm, template, translator, coverage, checkDict, fmtNumber, fmtDate };
