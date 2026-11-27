'use strict';
// Compte en ligne (lots 3.2 et 3.3, préparation, D-82) — module autonome : ni réseau, ni stockage, ni accès aux autres domaines.
// Spécification : docs/phase3/10-dossier-lots-3.2-3.7.md § 3. Le client Supabase est INJECTÉ ; ce module ne le charge jamais.
// Règles :
//  - configuration : URL d'un projet Supabase (https, *.supabase.co, ou Supabase local 127.0.0.1) et clé PUBLIQUE seulement ;
//    toute clé secrète ou « service_role » est refusée avant d'être gardée ;
//  - inscription et mot de passe oublié : message identique que le compte existe ou non (pas d'énumération) ;
//  - erreurs Supabase traduites en français, sans détail technique ni e-mail renvoyé ;
//  - déconnexion locale par défaut : les données de l'appareil ne sont jamais touchées ;
//  - sans compte, l'application reste entièrement locale (aucun utilisateur anonyme créé côté serveur).

const LIMITS = Object.freeze({ email: 254, passwordMin: 10, passwordMax: 72, label: 60 });
const NEUTRAL = Object.freeze({
  signUp: 'Si cette adresse peut être utilisée, un e-mail de confirmation vient d\'être envoyé. Ouvrez-le pour activer le compte.',
  reset: 'Si un compte existe pour cette adresse, un lien de réinitialisation vient d\'être envoyé.',
  magic: 'Si cette adresse peut être utilisée, un lien de connexion vient d\'être envoyé. Il expire au bout d\'une heure.'
});
const MESSAGES = Object.freeze({
  invalid_credentials: 'Adresse ou mot de passe incorrect.',
  email_not_confirmed: 'Confirmez d\'abord votre adresse avec le lien reçu par e-mail.',
  rate_limited: 'Trop de tentatives. Réessayez dans quelques minutes.',
  weak_password: 'Mot de passe trop faible : au moins 10 caractères, avec lettres et chiffres.',
  invalid_email: 'Adresse e-mail invalide.',
  session_expired: 'Session expirée : reconnectez-vous. Vos données restent sur cet appareil.',
  device_revoked: 'Cet appareil a été déconnecté du compte. Vos données restent sur cet appareil.',
  network: 'Pas de connexion au service. Panel continue en local.',
  not_configured: 'Aucun projet en ligne n\'est configuré : Panel fonctionne en local.',
  unavailable: 'La bibliothèque de connexion n\'a pas pu être chargée (connexion au serveur de Panel requise).',
  unknown: 'Action impossible pour le moment. Réessayez plus tard.',
  mfa_code: 'Code à 6 chiffres incorrect ou expiré.',
  pwned_password: 'Ce mot de passe figure dans des fuites de données connues. Choisissez-en un autre.'
});

const str = v => (v === undefined || v === null ? '' : String(v)).trim();

// Jeton JWT : lecture du rôle sans vérification (seul but : refuser une clé de service collée par erreur)
function jwtRole(token) {
  const parts = str(token).split('.');
  if (parts.length !== 3) return '';
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf8');
    return str(JSON.parse(json).role);
  } catch (_) { return ''; }
}

function parseConfig(input) {
  const i = input || {}, errors = [];
  const url = str(i.url).replace(/\/+$/, ''), key = str(i.publishableKey);
  let ref = '';
  const m = /^https:\/\/([a-z0-9]{20})\.supabase\.co$/.exec(url);
  if (m) ref = m[1];
  else if (!/^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/.test(url)) errors.push('Adresse du projet invalide : https://<référence>.supabase.co attendu.');
  if (!key) errors.push('Clé publique manquante.');
  else if (/^sb_secret_/.test(key) || jwtRole(key) === 'service_role') errors.push('Clé SECRÈTE refusée : seule la clé publique (publishable ou anon) va dans l\'application.');
  else if (!/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(key) && jwtRole(key) !== 'anon') errors.push('Clé publique non reconnue (sb_publishable_… ou clé anon).');
  return errors.length ? { ok: false, errors } : { ok: true, errors: [], config: { url, publishableKey: key, ref, local: !ref } };
}

function validateEmail(email) {
  const e = str(email).toLowerCase();
  return e.length <= LIMITS.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : '';
}

function passwordIssues(pw) {
  const p = String(pw || ''), out = [];
  if (p.length < LIMITS.passwordMin) out.push('au moins ' + LIMITS.passwordMin + ' caractères');
  if (p.length > LIMITS.passwordMax) out.push('au plus ' + LIMITS.passwordMax + ' caractères');
  if (!/[A-Za-zÀ-ÿ]/.test(p) || !/\d/.test(p)) out.push('des lettres et des chiffres');
  return out;
}

// D-130 : mots de passe divulgués (Pwned Passwords, k-anonymat). Seuls les 5 premiers caractères de l'empreinte SHA-1
// quittent l'appareil ; le service renvoie toutes les fins d'empreinte qui commencent ainsi, la comparaison se fait ici.
// fetch est injecté (jamais d'appel réseau implicite) ; null = vérification impossible, qui ne bloque jamais l'inscription.
async function pwnedCount(password, deps) {
  const d = deps || {}, p = String(password || '');
  const subtle = d.subtle || (typeof crypto !== 'undefined' && crypto.subtle);
  if (!p || typeof d.fetch !== 'function' || !subtle) return null;
  try {
    const buf = await subtle.digest('SHA-1', new TextEncoder().encode(p));
    const hex = Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const ask = d.fetch('https://api.pwnedpasswords.com/range/' + hex.slice(0, 5), { headers: { 'Add-Padding': 'true' }, credentials: 'omit', referrerPolicy: 'no-referrer' });
    const r = await Promise.race([ask, new Promise(res => setTimeout(() => res(null), d.timeoutMs || 4000))]);
    if (!r || !r.ok) return null;
    const suffix = hex.slice(5);
    for (const line of String(await r.text()).split('\n')) {
      const i = line.indexOf(':');
      if (i > 0 && line.slice(0, i).trim() === suffix) return parseInt(line.slice(i + 1), 10) || 0;
    }
    return 0;
  } catch (_) { return null; }
}

// Codes Supabase Auth (error.code / status) → code Panel ; jamais le message d'origine
function mapAuthError(err) {
  const e = err || {}, code = str(e.code || e.error_code || e.name).toLowerCase(), status = Number(e.status) || 0, msg = str(e.message).toLowerCase();
  let k = 'unknown';
  if (code === 'invalid_credentials' || /invalid login credentials/.test(msg)) k = 'invalid_credentials';
  else if (code === 'email_not_confirmed' || /email not confirmed/.test(msg)) k = 'email_not_confirmed';
  else if (/rate_limit|over_.*_limit/.test(code) || status === 429) k = 'rate_limited';
  else if (code === 'weak_password') k = 'weak_password';
  else if (code === 'email_address_invalid' || code === 'validation_failed') k = 'invalid_email';
  else if (code === 'session_expired' || code === 'refresh_token_not_found' || code === 'session_not_found') k = 'session_expired';
  else if (code === 'device_revoked') k = 'device_revoked';
  else if (code === 'network' || e instanceof TypeError || /failed to fetch|network/.test(msg)) k = 'network';
  return { code: k, message: MESSAGES[k] };
}

// État affiché du compte : local (aucun compte), connecté, session expirée
function accountState(session, nowMs) {
  if (!session || !session.user) return { state: 'local', label: 'Mode local' };
  const exp = Number(session.expires_at) * 1000;
  if (exp && nowMs && exp <= nowMs && !session.refresh_token) return { state: 'expired', label: 'Session expirée' };
  const email = str(session.user.email);
  return { state: 'signedIn', label: 'Connecté', email, confirmed: !!session.user.email_confirmed_at };
}

// Flux d'authentification sur un client supabase-js injecté (auth.signUp, signInWithPassword, signOut, resetPasswordForEmail, getSession)
function createAuthFlow(client, opts) {
  const o = opts || {};
  if (!client || !client.auth) throw new Error('client Supabase requis');
  const A = client.auth;
  const fail = e => ({ ok: false, error: mapAuthError(e) });
  const guard = async fn => { try { return await fn(); } catch (e) { return fail(e); } };
  return {
    signUp: (email, password) => guard(async () => {
      const em = validateEmail(email);
      if (!em) return { ok: false, error: { code: 'invalid_email', message: MESSAGES.invalid_email } };
      const issues = passwordIssues(password);
      if (issues.length) return { ok: false, error: { code: 'weak_password', message: 'Mot de passe : ' + issues.join(', ') + '.' } };
      if (typeof o.pwnedFetch === 'function' && (await pwnedCount(password, { fetch: o.pwnedFetch })) > 0) return { ok: false, error: { code: 'pwned_password', message: MESSAGES.pwned_password } };
      const r = await A.signUp({ email: em, password, options: o.redirectTo ? { emailRedirectTo: o.redirectTo } : undefined });
      // « déjà inscrit » et succès donnent le même message (pas d'énumération) ; seules les limites et le réseau sont signalés
      if (r && r.error) { const m = mapAuthError(r.error); if (m.code === 'rate_limited' || m.code === 'network' || m.code === 'weak_password') return { ok: false, error: m }; }
      return { ok: true, message: NEUTRAL.signUp };
    }),
    signIn: (email, password) => guard(async () => {
      const em = validateEmail(email);
      if (!em || !password) return { ok: false, error: { code: 'invalid_credentials', message: MESSAGES.invalid_credentials } };
      const r = await A.signInWithPassword({ email: em, password });
      if (r && r.error) return fail(r.error);
      return { ok: true, session: r && r.data ? r.data.session : null };
    }),
    // Déconnexion locale par défaut ; « tous les appareils » révoque les sessions côté Auth. Aucune donnée locale touchée.
    signOut: everywhere => guard(async () => {
      const r = await A.signOut({ scope: everywhere ? 'global' : 'local' });
      if (r && r.error) return fail(r.error);
      return { ok: true };
    }),
    resetPassword: email => guard(async () => {
      const em = validateEmail(email);
      if (!em) return { ok: false, error: { code: 'invalid_email', message: MESSAGES.invalid_email } };
      const r = await A.resetPasswordForEmail(em, o.redirectTo ? { redirectTo: o.redirectTo } : undefined);
      if (r && r.error) { const m = mapAuthError(r.error); if (m.code === 'rate_limited' || m.code === 'network') return { ok: false, error: m }; }
      return { ok: true, message: NEUTRAL.reset };
    }),
    // D-114 : connexion avec Google ou Apple (OAuth, flux PKCE de supabase-js : aucun mot de passe ne transite par Panel)
    oauth: provider => guard(async () => {
      if (!OAUTH.includes(provider)) return { ok: false, error: { code: 'unknown', message: MESSAGES.unknown } };
      const r = await A.signInWithOAuth({ provider, options: { redirectTo: o.redirectTo, scopes: provider === 'apple' ? 'name email' : 'openid email profile' } });
      if (r && r.error) return fail(r.error);
      return { ok: true, url: r && r.data ? r.data.url : '' };
    }),
    // Lien de connexion par e-mail, sans mot de passe ; même message que le compte existe ou non
    magicLink: email => guard(async () => {
      const em = validateEmail(email);
      if (!em) return { ok: false, error: { code: 'invalid_email', message: MESSAGES.invalid_email } };
      const r = await A.signInWithOtp({ email: em, options: { emailRedirectTo: o.redirectTo, shouldCreateUser: true } });
      if (r && r.error) { const m = mapAuthError(r.error); if (m.code === 'rate_limited' || m.code === 'network') return { ok: false, error: m }; }
      return { ok: true, message: NEUTRAL.magic };
    }),
    // Double authentification par application (TOTP) : inscription, vérification, liste des facteurs
    mfaEnroll: () => guard(async () => {
      const r = await A.mfa.enroll({ factorType: 'totp', friendlyName: 'Panel' });
      if (r && r.error) return fail(r.error);
      return { ok: true, factorId: r.data.id, qr: r.data.totp && r.data.totp.qr_code, uri: r.data.totp && r.data.totp.uri };
    }),
    mfaVerify: (factorId, code) => guard(async () => {
      if (!/^\d{6}$/.test(str(code))) return { ok: false, error: { code: 'mfa_code', message: MESSAGES.mfa_code } };
      const r = await A.mfa.challengeAndVerify({ factorId, code: str(code) });
      if (r && r.error) return { ok: false, error: { code: 'mfa_code', message: MESSAGES.mfa_code } };
      return { ok: true };
    }),
    mfaFactors: () => guard(async () => {
      const r = await A.mfa.listFactors();
      if (r && r.error) return fail(r.error);
      return { ok: true, totp: ((r.data && r.data.totp) || []).filter(f => f.status === 'verified').map(f => ({ id: f.id, name: f.friendly_name || 'Application' })) };
    }),
    session: () => guard(async () => {
      const r = await A.getSession();
      if (r && r.error) return fail(r.error);
      return { ok: true, session: r && r.data ? r.data.session : null };
    })
  };
}

// D-114 : moyens de connexion proposés et profil d'inscription
const OAUTH = ['apple', 'google'];
const PROVIDERS = Object.freeze([
  { key: 'apple', label: 'Continuer avec Apple' },
  { key: 'google', label: 'Continuer avec Google' },
  { key: 'email', label: 'Continuer avec un e-mail' }
]);
const HANDLE = /^[a-z0-9](?:[a-z0-9._]{1,22}[a-z0-9])$/;
// Pseudos réservés : l'équipe et les grandes maisons ne les obtiennent qu'après vérification (contre l'usurpation)
const RESERVED = ['panel', 'admin', 'support', 'moderation', 'equipe', 'staff', 'official', 'officiel', 'marvel', 'dc', 'dccomics', 'urbancomics', 'imagecomics', 'darkhorse', 'idw', 'boom', 'glenat', 'dargaud', 'delcourt', 'casterman', 'panini'];
// Profil d'inscription : pseudo, année de naissance (13 ans au moins, tranche calculée), type de compte, consentements
function signupProfile(input, nowYear, types) {
  const i = input || {}, e = [];
  const handle = str(i.handle).toLowerCase().replace(/^@/, '');
  if (!HANDLE.test(handle)) e.push('Pseudo : 3 à 24 caractères, lettres, chiffres, point ou tiret bas.');
  else if (RESERVED.includes(handle.replace(/[._]/g, ''))) e.push('Ce pseudo est réservé : une maison ou une marque l\'obtient après vérification.');
  const y = Number(i.birthYear), age = nowYear - y;
  if (!Number.isInteger(y) || y < nowYear - 120 || y > nowYear) e.push('Année de naissance invalide.');
  else if (age < 13) e.push('Panel n\'ouvre pas de compte avant 13 ans.');
  const type = (types || ['collector']).includes(i.type) ? i.type : 'collector';
  if (type !== 'collector' && Number.isInteger(y) && age < 18) e.push('Les comptes pros sont réservés aux adultes.');
  if (!i.terms) e.push('Acceptez les conditions d\'utilisation et la politique de confidentialité.');
  return e.length ? { ok: false, errors: e } : { ok: true, errors: [], profile: { handle, birthYear: y, band: age >= 18 ? '18+' : age >= 15 ? '15-17' : '13-14', type, needsVerification: type !== 'collector', marketing: !!i.marketing } };
}

module.exports = { OAUTH, PROVIDERS, signupProfile, LIMITS, NEUTRAL, MESSAGES, parseConfig, validateEmail, passwordIssues, pwnedCount, mapAuthError, accountState, createAuthFlow };
