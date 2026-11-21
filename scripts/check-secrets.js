#!/usr/bin/env node
'use strict';
// Détection de secrets dans les fichiers SUIVIS par Git (git ls-files). Lot 3.1.
// N'affiche jamais une valeur trouvée en entier (masquage). Code de sortie 1 si une correspondance subsiste.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MAX_BYTES = 5 * 1024 * 1024;

const PATTERNS = [
  { name: 'JWT', re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { name: 'clé service_role', re: /service_role["'\s:=]+["']?eyJ/gi },
  { name: 'clé Supabase secrète', re: /\bsb_secret_[A-Za-z0-9_-]{10,}/g },
  { name: 'clé Stripe', re: /\b[sr]k_(live|test)_[A-Za-z0-9]{10,}/g },
  { name: 'clé hexadécimale de 40 caractères (format Comic Vine)', re: /(?<![A-Fa-f0-9])[a-f0-9]{40}(?![A-Fa-f0-9])/g },
  { name: 'mot de passe en clair', re: /\b(password|passwd|mot_de_passe|motdepasse)\b\s*[:=]\s*["'][^"'\s]{4,}["']/gi },
  { name: 'URL avec identifiants', re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s\/:@"'<>]+:[^\s\/@"'<>]+@[^\s\/"'<>]+/gi },
  { name: 'clé privée', re: /-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/g }
];

// Exception de contexte : une empreinte de commit Git dans une URL de dépôt (« /+/<sha>/ », « /commit/<sha> »…) n'est pas une clé.
// Cas rencontré : android-app/android/app/build.gradle (commentaire généré par Capacitor, lien googlesource).
const CONTEXT_OK = {
  'clé hexadécimale de 40 caractères (format Comic Vine)': (line, idx) => /(\/\+\/|\/commit\/|\/blob\/|\/tree\/)$/.test(line.slice(0, idx)),
  // Base Supabase LOCALE (Docker) : identifiants publics par défaut postgres:postgres sur 127.0.0.1 / localhost uniquement.
  'URL avec identifiants': (line, idx) => /^postgres(ql)?:\/\/postgres:postgres@(127\.0\.0\.1|localhost)(:\d+)?\//.test(line.slice(idx))
};

// Liste blanche explicite : chaque exception est justifiée.
const ALLOW = [
  // Le détecteur lui-même décrit les motifs.
  { file: /^scripts\/check-secrets\.js$/, name: /.*/, reason: 'définition des motifs' },
  // Bibliothèque tierce figée (D-85), identique octet pour octet au paquet npm zxing-wasm 3.1.3 (empreinte dans vendor/README.md) :
  // la chaîne hexadécimale fait partie du code compilé du lecteur, pas d'une clé. Exception limitée à ce fichier et à ce motif.
  { file: /^vendor\/zxing-wasm-3\.1\.3\/iife\/reader\/index\.js$/, name: 'clé hexadécimale de 40 caractères (format Comic Vine)', reason: 'code tiers vérifié par empreinte' },
  // Provenance des cartes (D-108) : le champ « commit » est l'empreinte Git du dépôt de l'utilisateur, pas une clé.
  { file: /^cartes\/SOURCE\.json$/, name: 'clé hexadécimale de 40 caractères (format Comic Vine)', reason: 'empreinte de commit Git (provenance)' }
];

const mask = s => (s.length <= 8 ? '****' : s.slice(0, 4) + '…' + '*'.repeat(4) + ` (${s.length} car.)`);
const allowed = (file, name) => ALLOW.some(a => a.file.test(file) && (a.name instanceof RegExp ? a.name.test(name) : a.name === name));

function main() {
  const files = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
  const problems = [];

  // 1. Fichiers qui ne doivent jamais être suivis.
  for (const f of files) {
    const p = f.replace(/\\/g, '/');
    if (/^\.secrets\//.test(p) || /(^|\/)\.env(\.|$)/.test(p) && !/\.env\.example$/.test(p) || /\.env$/.test(p)) problems.push({ file: p, line: 0, name: 'fichier interdit suivi par Git', value: '' });
    if (/(^|\/)\.cache\//.test(p) || /\.backup/.test(p) || /^_backups\//.test(p) || /\.edge-test-profile/.test(p)) problems.push({ file: p, line: 0, name: 'cache, sauvegarde ou profil suivi par Git', value: '' });
  }

  // 2. Contenu.
  let scanned = 0, skipped = 0;
  for (const f of files) {
    const abs = path.join(ROOT, f);
    let st; try { st = fs.statSync(abs); } catch (_) { continue; }
    if (!st.isFile() || st.size > MAX_BYTES) { skipped++; continue; }
    const buf = fs.readFileSync(abs);
    if (buf.includes(0)) { skipped++; continue; } // binaire
    scanned++;
    const lines = buf.toString('utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const { name, re } of PATTERNS) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(line))) {
          if (CONTEXT_OK[name] && CONTEXT_OK[name](line, m.index)) continue;
          if (!allowed(f.replace(/\\/g, '/'), name)) problems.push({ file: f, line: i + 1, name, value: m[0] });
        }
      }
    });
  }

  console.log(`check-secrets : ${files.length} fichiers suivis, ${scanned} analysés, ${skipped} ignorés (binaires ou > 5 Mo).`);
  if (!problems.length) { console.log('check-secrets : 0 correspondance.'); return 0; }
  for (const p of problems) console.log(`  ${p.file}${p.line ? ':' + p.line : ''} — ${p.name}${p.value ? ' — ' + mask(p.value) : ''}`);
  console.log(`check-secrets : ${problems.length} correspondance(s).`);
  return 1;
}

// Analyse d'un texte (utilisée par les tests de sensibilité du détecteur).
function scanText(text) {
  const out = [];
  text.split(/\r?\n/).forEach((line, i) => {
    for (const { name, re } of PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) {
        if (CONTEXT_OK[name] && CONTEXT_OK[name](line, m.index)) continue;
        out.push({ line: i + 1, name, masked: mask(m[0]) });
      }
    }
  });
  return out;
}

module.exports = { scanText, mask };
if (require.main === module) process.exitCode = main();
