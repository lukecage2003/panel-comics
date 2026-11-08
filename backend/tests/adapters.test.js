'use strict';
// Adaptateurs Supabase (transport RPC, session, stockage) : vérifiés avec un faux client supabase-js adossé à PGlite.
// Valide les noms des paramètres RPC et la correspondance des erreurs ; ne valide PAS un projet Supabase réel (aucun réseau).
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness');
const { createSyncEngine, memoryStorage } = require('../sync-engine/engine');
const { mapRpcError, createSupabaseTransport, createSupabaseSession, createWebStorage } = require('../sync-engine/adapters');

let db;
test.before(async () => { db = await H.freshDb(); await H.createUsers(db, H.USER_A, H.USER_B); });
test.after(async () => { if (db) await db.close(); });

// Faux client : client.schema('api').rpc(fn, args) → { data, error } comme supabase-js ; auth minimal avec expiration
function fakeClient(userId, { expiresIn = 3600, now = () => Date.now(), failNext } = {}) {
  let session = { user: { id: userId }, expires_at: Math.floor(now() / 1000) + expiresIn };
  const listeners = [];
  const calls = [];
  const rpc = async (fn, args) => {
    calls.push([fn, Object.keys(args).sort().join(',')]);
    if (failNext && failNext.n > 0) { failNext.n--; throw new TypeError('Failed to fetch'); }
    if (!session || session.expires_at * 1000 <= now()) return { data: null, error: { code: 'PGRST301', message: 'JWT expired' } };
    await H.asUser(db, session.user.id);
    try {
      const sql = fn === 'sync_push' ? 'select api.sync_push($1, $2::jsonb, $3) as r' : 'select api.sync_pull($1, $2) as r';
      const params = fn === 'sync_push' ? [args.p_device, JSON.stringify(args.p_ops), args.p_confirm_mass_delete] : [args.p_since, args.p_max];
      return { data: (await db.query(sql, params)).rows[0].r, error: null };
    } catch (e) { return { data: null, error: { code: e.code, message: e.message } }; }
  };
  return {
    calls,
    schema: name => { assert.equal(name, 'api'); return { rpc }; },
    auth: {
      getSession: async () => ({ data: { session } }),
      refreshSession: async () => { session = { user: { id: userId }, expires_at: Math.floor(now() / 1000) + expiresIn }; listeners.forEach(f => f('TOKEN_REFRESHED', session)); return { data: { session }, error: null }; },
      onAuthStateChange: f => { listeners.push(f); return { data: { subscription: { unsubscribe: () => listeners.splice(listeners.indexOf(f), 1) } } }; }
    }
  };
}
const newDevice = async (uid, label) => { await H.asUser(db, uid); return (await db.query("insert into app.devices (user_id, label, platform) values ($1, $2, 'web') returning id", [uid, label])).rows[0].id; };

test('correspondance des erreurs : session, appareil révoqué, réseau, requête invalide', () => {
  assert.equal(mapRpcError({ code: 'PGRST301', message: 'JWT expired' }).code, 'session_expired');
  assert.equal(mapRpcError({ status: 401, message: 'x' }).code, 'session_expired');
  assert.equal(mapRpcError({ code: '42501', message: 'device_revoked_or_unknown' }).code, 'device_revoked');
  assert.equal(mapRpcError(new TypeError('Failed to fetch')).code, 'network');
  assert.equal(mapRpcError({ code: '22023', message: 'invalid_batch' }).code, 'invalid');
});

test('transport Supabase : paramètres de la migration 8, deux appareils convergent', async () => {
  const c1 = fakeClient(H.USER_A), c2 = fakeClient(H.USER_A);
  const s1 = createSupabaseSession(c1), s2 = createSupabaseSession(c2);
  assert.ok(await s1.init()); assert.ok(await s2.init());
  const d1 = await newDevice(H.USER_A, 'web A'), d2 = await newDevice(H.USER_A, 'web B');
  const e1 = createSyncEngine({ storage: memoryStorage(), transport: createSupabaseTransport(c1), session: s1, deviceId: d1, pageSize: 5 });
  const e2 = createSyncEngine({ storage: memoryStorage(), transport: createSupabaseTransport(c2), session: s2, deviceId: d2, pageSize: 5 });
  for (let i = 0; i < 7; i++) e1.upsert('copies', 'ad_' + i, { series: 'Adaptateur', issue: '#' + i });
  e2.upsert('reading_states', 'loc:adaptateur#1@', { status: 'read' });
  assert.ok((await e1.sync()).ok);
  assert.ok((await e2.sync()).ok);
  assert.ok((await e1.sync()).ok);
  assert.deepEqual(e1.fingerprint(), e2.fingerprint());
  assert.equal(e2.fingerprint().copies.length, 7);
  assert.deepEqual([...new Set(c1.calls.map(c => c.join(':')))].sort(), ['sync_pull:p_max,p_since', 'sync_push:p_confirm_mass_delete,p_device,p_ops']);
});

test('session expirée : arrêt propre sans perte, reprise après rafraîchissement', async () => {
  let t = Date.now();
  const c = fakeClient(H.USER_B, { expiresIn: 60, now: () => t });
  const s = createSupabaseSession(c, { now: () => t, marginMs: 0 });
  await s.init();
  const dev = await newDevice(H.USER_B, 'web');
  const e = createSyncEngine({ storage: memoryStorage(), transport: createSupabaseTransport(c), session: s, deviceId: dev });
  e.upsert('copies', 'exp_1', { series: 'Expiration' });
  t += 61000;
  const r = await e.push();
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'session_expired');
  assert.equal(e.pending(), 1);
  assert.ok(await s.refresh());
  assert.ok((await e.push()).ok);
  assert.equal(e.pending(), 0);
});

test('coupure réseau : opérations conservées, rejouées avec les mêmes op_id, aucun doublon', async () => {
  const fail = { n: 1 };
  const c = fakeClient(H.USER_A, { failNext: fail });
  const s = createSupabaseSession(c); await s.init();
  const dev = await newDevice(H.USER_A, 'web coupé');
  const e = createSyncEngine({ storage: memoryStorage(), transport: createSupabaseTransport(c), session: s, deviceId: dev });
  e.upsert('copies', 'net_1', { series: 'Coupure' });
  const ids = e.state().outbox.map(o => o.op_id);
  const r1 = await e.push();
  assert.equal(r1.reason, 'network');
  assert.deepEqual(e.state().outbox.map(o => o.op_id), ids);
  const r2 = await e.push();
  assert.ok(r2.ok);
  await H.asAdmin(db);
  assert.equal((await db.query("select count(*)::int n from app.sync_ops where user_id = $1 and op_id = $2", [H.USER_A, ids[0]])).rows[0].n, 1);
});

test('stockage Web : clé contrôlée, état relu après redémarrage', () => {
  const mem = new Map();
  const ls = { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)) };
  assert.throws(() => createWebStorage(ls, 'autre_cle'));
  const st = createWebStorage(ls, 'panel_sync_test_device');
  assert.equal(st.load(), null);
  st.save({ version: 1, outbox: [{ op_id: 'x' }] });
  assert.deepEqual(createWebStorage(ls, 'panel_sync_test_device').load().outbox, [{ op_id: 'x' }]);
});
