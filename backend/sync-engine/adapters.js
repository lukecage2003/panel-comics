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

module.exports = { mapRpcError, createSupabaseTransport, createSupabaseSession, createWebStorage };
