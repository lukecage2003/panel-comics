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
  reset: 'Si un compte existe pour cette adresse, un lien de réinitialisation vient d\'être envoyé.'
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
  unknown: 'Action impossible pour le moment. Réessayez plus tard.'
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
    session: () => guard(async () => {
      const r = await A.getSession();
      if (r && r.error) return fail(r.error);
      return { ok: true, session: r && r.data ? r.data.session : null };
    })
  };
}

module.exports = { LIMITS, NEUTRAL, MESSAGES, parseConfig, validateEmail, passwordIssues, mapAuthError, accountState, createAuthFlow };
