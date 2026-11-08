'use strict';
// Lot 3.4 (local) — Moteur de synchronisation client : outbox persistante, envoi par lots (sync_push), réception paginée (sync_pull).
// Indépendant du réseau : le transport et le stockage sont injectés (tests : PGlite ; plus tard : client Supabase).
// Aucun appel réseau ici ; rien n'active une synchronisation réelle (D-31).
// Garanties (docs/phase3/10 § 4.3) : mêmes op_id après une coupure, état enregistré après chaque lot accepté et chaque page reçue,
// outbox liée au compte (jamais envoyée par un autre compte), arrêt propre si la session expire.

const ENTITIES = ['copies', 'locations', 'pulls', 'series_follows', 'reading_progress', 'reading_states'];

const uuid = () => {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return require('crypto').randomUUID();
};
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const rowKey = (entity, id) => entity + '|' + id;

// Stockage en mémoire, sérialisable (simule IndexedDB : un « redémarrage » recharge l'état enregistré)
function memoryStorage(initial) {
  let saved = initial ? clone(initial) : null;
  return { load: () => clone(saved), save: s => { saved = clone(s); }, snapshot: () => clone(saved) };
}

function createSyncEngine({ storage, transport, session, deviceId, batchSize = 200, pageSize = 500, massDeleteThreshold = 50 }) {
  if (!storage || !transport || !session || !deviceId) throw new Error('storage, transport, session et deviceId sont requis');
  const empty = () => ({ version: 1, userId: null, rows: {}, outbox: [], cursor: 0, quarantine: [], conflicts: [], status: 'idle' });
  let st = storage.load() || empty();
  const persist = () => storage.save(st);
  const uid = () => session.userId();

  // Outbox d'un autre compte : jamais envoyée ; mise en quarantaine (conservée, exportable)
  const bindAccount = () => {
    const u = uid();
    if (!u) return false;
    if (st.userId && st.userId !== u) {
      st.quarantine.push({ userId: st.userId, outbox: st.outbox, rows: st.rows, cursor: st.cursor, at: new Date().toISOString() });
      st = Object.assign(empty(), { quarantine: st.quarantine });
    }
    st.userId = u;
    persist();
    return true;
  };

  const local = (entity, id) => st.rows[rowKey(entity, id)] || null;
  const upsert = (entity, id, patch) => {
    if (!ENTITIES.includes(entity)) throw new Error('entité inconnue : ' + entity);
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('patch invalide');
    const k = rowKey(entity, id), r = st.rows[k] || { entity, id, data: {}, rev: 0, deleted: false };
    r.data = Object.assign({}, r.data, clone(patch)); r.deleted = false;
    st.rows[k] = r;
    st.outbox.push({ op_id: uuid(), entity, id, kind: 'upsert', base_rev: r.rev || 0, patch: clone(patch), schema_version: 1 });
    persist();
  };
  const remove = (entity, id) => {
    const k = rowKey(entity, id), r = st.rows[k];
    if (r) r.deleted = true;
    st.outbox.push({ op_id: uuid(), entity, id, kind: 'delete', base_rev: r ? r.rev || 0 : 0, schema_version: 1 });
    persist();
  };

  // Envoi : un lot à la fois ; sur coupure, le même lot (mêmes op_id) est rejoué au prochain essai
  const push = async (opts = {}) => {
    if (!session.isValid()) { st.status = 'session_expired'; persist(); return { ok: false, reason: 'session_expired', pending: st.outbox.length }; }
    if (!bindAccount()) return { ok: false, reason: 'signed_out' };
    let sent = 0;
    const out = { applied: 0, duplicate: 0, merged: 0, conflict: 0 };
    while (st.outbox.length) {
      const batch = st.outbox.slice(0, batchSize);
      const deletes = batch.filter(o => o.kind === 'delete').length;
      if (deletes > massDeleteThreshold && !opts.confirmMassDelete) { st.status = 'needs_confirmation'; persist(); return { ok: false, reason: 'needs_confirmation', deletes }; }
      let res;
      try { res = await transport.push(deviceId, batch, !!opts.confirmMassDelete); }
      catch (err) {
        if (err && err.code === 'session_expired') { st.status = 'session_expired'; persist(); return { ok: false, reason: 'session_expired', pending: st.outbox.length }; }
        if (err && err.code === 'device_revoked') { st.status = 'device_revoked'; persist(); return { ok: false, reason: 'device_revoked', pending: st.outbox.length }; }
        st.status = 'offline'; persist();
        return { ok: false, reason: 'network', pending: st.outbox.length, sent };
      }
      if (!res || res.status !== 'ok') { st.status = res && res.status || 'error'; persist(); return { ok: false, reason: res && res.status || 'error' }; }
      res.results.forEach((r, i) => {
        const op = batch[i], k = rowKey(op.entity, op.id), row = st.rows[k];
        out[r.status] = (out[r.status] || 0) + 1;
        if (r.status === 'duplicate') out[r.original_status] = (out[r.original_status] || 0);
        if (row && r.rev) row.rev = Math.max(row.rev || 0, Number(r.rev));
        if (r.server_row && row) {
          // Le serveur fait foi pour les champs en conflit ; les champs locaux non concurrents ont été appliqués
          row.data = clone(r.server_row.data); row.rev = Number(r.server_row.rev); row.deleted = !!r.server_row.deleted_at;
        }
        if (r.status === 'conflict') st.conflicts.push({ entity: op.entity, id: op.id, op_id: op.op_id, at: new Date().toISOString() });
      });
      st.outbox = st.outbox.slice(batch.length);
      sent += batch.length;
      persist(); // état enregistré après chaque lot accepté
    }
    st.status = 'idle'; persist();
    return Object.assign({ ok: true, sent }, out);
  };

  // Réception paginée par curseur ; une page appliquée est enregistrée avant la suivante (reprise sans trou ni doublon)
  const pull = async (opts = {}) => {
    if (!session.isValid()) { st.status = 'session_expired'; persist(); return { ok: false, reason: 'session_expired' }; }
    if (!bindAccount()) return { ok: false, reason: 'signed_out' };
    let pages = 0, received = 0;
    for (;;) {
      if (opts.maxPages && pages >= opts.maxPages) return { ok: true, partial: true, pages, received, cursor: st.cursor };
      let res;
      try { res = await transport.pull(st.cursor, pageSize); }
      catch (err) { st.status = err && err.code === 'session_expired' ? 'session_expired' : 'offline'; persist(); return { ok: false, reason: st.status === 'offline' ? 'network' : st.status, pages, received, cursor: st.cursor }; }
      if (res.status === 'resync_required') { st.status = 'resync_required'; persist(); return { ok: false, reason: 'resync_required' }; }
      const pendingIds = new Set(st.outbox.map(o => rowKey(o.entity, o.id)));
      res.rows.forEach(r => {
        const k = rowKey(r.entity, r.id), prev = st.rows[k];
        if (prev && Number(prev.rev || 0) >= Number(r.rev)) return; // déjà à jour : pas de doublon
        const data = clone(r.data);
        // Modifications locales en attente : conservées par-dessus la version reçue (elles partiront au prochain envoi)
        if (pendingIds.has(k) && prev) st.outbox.filter(o => rowKey(o.entity, o.id) === k && o.kind === 'upsert').forEach(o => Object.assign(data, clone(o.patch)));
        st.rows[k] = { entity: r.entity, id: r.id, data, rev: Number(r.rev), deleted: !!r.deleted_at };
        received++;
      });
      st.cursor = Number(res.next_rev);
      pages++;
      persist();
      if (!res.has_more) break;
    }
    st.status = 'idle'; persist();
    return { ok: true, pages, received, cursor: st.cursor };
  };

  const sync = async (opts = {}) => { const p = await push(opts); if (!p.ok) return { ok: false, push: p }; const q = await pull(opts); return { ok: q.ok, push: p, pull: q }; };
  // Vérification (« transféré » ne veut pas dire « synchronisé ») : comptes et empreintes par entité
  const fingerprint = () => {
    const by = {};
    Object.values(st.rows).filter(r => !r.deleted).sort((a, b) => rowKey(a.entity, a.id).localeCompare(rowKey(b.entity, b.id))).forEach(r => {
      const sorted = JSON.stringify(Object.keys(r.data).sort().reduce((o, k) => { o[k] = r.data[k]; return o; }, {}));
      (by[r.entity] = by[r.entity] || []).push(r.id + '=' + sorted);
    });
    return by;
  };

  return {
    upsert, remove, push, pull, sync, local, fingerprint,
    state: () => clone(st), pending: () => st.outbox.length, status: () => st.status
  };
}

// Session locale (lot 3.2/3.3, sans fournisseur externe) : état connecté / expiré / déconnecté, sans aucun secret stocké.
function createLocalSession() {
  let user = null, expired = false;
  return {
    signIn: id => { if (!/^[0-9a-f-]{36}$/i.test(String(id))) throw new Error('identifiant invalide'); user = String(id); expired = false; },
    signOut: () => { user = null; expired = false; },
    expire: () => { expired = true; },
    userId: () => (expired ? null : user),
    isValid: () => !!user && !expired
  };
}

module.exports = { createSyncEngine, createLocalSession, memoryStorage, ENTITIES };
