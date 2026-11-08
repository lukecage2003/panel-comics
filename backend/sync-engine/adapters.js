'use strict';
// Adaptateurs du moteur de synchronisation vers Supabase (lots 3.2 à 3.4), séparés du moteur et du réseau.
// Aucun appel n'est fait ici à l'import : chaque adaptateur reçoit un client fourni par l'appelant (supabase-js ou faux client de test).
// Rien n'active une synchronisation réelle : l'application garde PANEL_SYNC_ENABLED = false tant que le projet n'existe pas (D-31).
// Validé localement contre PGlite (backend/tests/adapters.test.js) ; JAMAIS validé contre un projet Supabase réel.

// Erreurs : un code stable pour le moteur (session_expired, device_revoked, network, invalid), le message d'origine conservé
const mapRpcError = err => {
  const e = err || {};
  const msg = String(e.message || e.error_description || e.hint || e);
  const out = (code) => Object.assign(new Error(msg), { code, cause: err });
  if (e.name === 'TypeError' || /fetch|network|Failed to fetch|ECONN|ETIMEDOUT/i.test(msg) && !e.code) return out('network');
  if (e.status === 401 || e.code === '28000' || e.code === 'PGRST301' || /not_authenticated|JWT expired|invalid JWT/i.test(msg)) return out('session_expired');
  if (e.code === '42501' || /device_revoked_or_unknown/.test(msg)) return out('device_revoked');
  if (e.code === '22023' || /invalid_(batch|op|cursor)/.test(msg)) return out('invalid');
  return out(e.code || 'error');
};

// Transport RPC : noms de paramètres identiques à la migration 8 (api.sync_push / api.sync_pull)
function createSupabaseTransport(client, { schema = 'api' } = {}) {
  if (!client || (typeof client.rpc !== 'function' && typeof client.schema !== 'function')) throw new Error('client Supabase requis');
  const rpc = async (fn, args) => {
    const target = typeof client.schema === 'function' ? client.schema(schema) : client;
    let res;
    try { res = await target.rpc(fn, args); } catch (e) { throw mapRpcError(e); }
    if (res && res.error) throw mapRpcError(res.error);
    return res ? res.data : null;
  };
  return {
    push: (deviceId, ops, confirm) => rpc('sync_push', { p_device: deviceId, p_ops: ops, p_confirm_mass_delete: !!confirm }),
    pull: (since, max) => rpc('sync_pull', { p_since: since, p_max: max })
  };
}

// Session : le moteur lit userId() et isValid() de façon synchrone ; l'adaptateur garde une copie à jour de la session du client
function createSupabaseSession(client, { now = () => Date.now(), marginMs = 30000 } = {}) {
  if (!client || !client.auth) throw new Error('client Supabase requis');
  let session = null, sub = null;
  const set = s => { session = s && s.user && s.user.id ? { userId: s.user.id, expiresAt: Number(s.expires_at || 0) * 1000 } : null; };
  return {
    async init() {
      const r = await client.auth.getSession();
      set(r && r.data && r.data.session);
      if (typeof client.auth.onAuthStateChange === 'function') {
        const h = client.auth.onAuthStateChange((_evt, s) => set(s));
        sub = h && h.data && h.data.subscription;
      }
      return !!session;
    },
    async refresh() {
      const r = await client.auth.refreshSession();
      if (r && r.error) { set(null); return false; }
      set(r && r.data && r.data.session);
      return !!session;
    },
    userId: () => (session && session.expiresAt - marginMs > now() ? session.userId : null),
    isValid: () => !!session && session.expiresAt - marginMs > now(),
    dispose() { if (sub && typeof sub.unsubscribe === 'function') sub.unsubscribe(); sub = null; }
  };
}

// Stockage synchrone de l'état du moteur dans un Storage du navigateur (localStorage), une clé par compte et par appareil
function createWebStorage(storage, key) {
  if (!storage || typeof storage.getItem !== 'function') throw new Error('Storage requis');
  if (!/^panel_sync_[a-z0-9_-]{1,80}$/i.test(String(key))) throw new Error('clé de stockage invalide');
  return {
    load: () => { try { const v = storage.getItem(key); return v ? JSON.parse(v) : null; } catch (_) { return null; } },
    save: s => { storage.setItem(key, JSON.stringify(s)); },
    snapshot: () => { const v = storage.getItem(key); return v ? JSON.parse(v) : null; }
  };
}

// Horloge logique hybride (lot 3.3, D-38) : « 13 chiffres ms - 4 chiffres compteur - appareil », comparable par ordre lexical.
// Monotone même si l'horloge murale recule ; observe() intègre une horloge reçue pour ne jamais produire une valeur plus ancienne.
function createHlc(deviceTag, { now = () => Date.now() } = {}) {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(deviceTag || ''))) throw new Error('identifiant d\'appareil invalide pour l\'horloge');
  let last = 0, count = 0;
  const fmt = () => String(last).padStart(13, '0') + '-' + String(count).padStart(4, '0') + '-' + deviceTag;
  return {
    tick() { const t = now(); if (t > last) { last = t; count = 0; } else { count++; if (count > 9999) { last++; count = 0; } } return fmt(); },
    observe(h) { const m = /^(\d{13})-(\d{4})-/.exec(String(h || '')); if (!m) return; const t = Number(m[1]), c = Number(m[2]); if (t > last || (t === last && c > count)) { last = t; count = c; } }
  };
}

// Compte (lot 3.3) : profil, préférences fusionnées par HLC, appareils ; noms de paramètres identiques à la migration 10
function createSupabaseAccount(client, { schema = 'api' } = {}) {
  if (!client || typeof client.schema !== 'function') throw new Error('client Supabase requis');
  const rpc = async (fn, args) => {
    let res;
    try { res = await client.schema(schema).rpc(fn, args || {}); } catch (e) { throw mapRpcError(e); }
    if (res && res.error) throw mapRpcError(res.error);
    return res ? res.data : null;
  };
  return {
    profile: () => rpc('my_profile'),
    updateProfile: patch => rpc('update_profile', { p_patch: patch }),
    roles: () => rpc('my_roles'),
    settings: () => rpc('settings_get'),
    mergeSettings: (deviceId, prefs, hlc) => rpc('settings_merge', { p_device: deviceId, p_prefs: prefs, p_hlc: hlc }),
    registerDevice: (label, platform, appVersion) => rpc('register_device', { p_label: label, p_platform: platform, p_app_version: appVersion || null }),
    devices: () => rpc('list_devices'),
    revokeDevice: id => rpc('revoke_device', { p_device: id }),
    // Lot 3.5 (migration 11) : conflits consignés, résolution réversible
    conflicts: openOnly => rpc('list_conflicts', { p_open_only: openOnly !== false }),
    resolveConflict: (deviceId, id, choice) => rpc('resolve_conflict', { p_device: deviceId, p_id: id, p_choice: choice })
  };
}

module.exports = { mapRpcError, createSupabaseTransport, createSupabaseSession, createWebStorage, createHlc, createSupabaseAccount };
