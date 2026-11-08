'use strict';
// Lot 3.4 / 3.5 / 3.7 (local, D-31) : sync_push / sync_pull et moteur client, sur PGlite.
// Plusieurs appareils simulés (moteurs distincts, même compte), coupures réseau, réponses perdues, reprise, conflits, sessions.
// Non couvert ici (Supabase local requis) : concurrence réelle de deux connexions, JWT réels, pg_dump / pg_restore.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness');
const { createSyncEngine, createLocalSession, memoryStorage } = require('../sync-engine/engine');

let db;
const netErr = () => Object.assign(new Error('réseau coupé (simulé)'), { code: 'network' });
const mapErr = e => {
  if (/device_revoked_or_unknown/.test(e.message)) return Object.assign(new Error(e.message), { code: 'device_revoked' });
  if (/not_authenticated/.test(e.message)) return Object.assign(new Error(e.message), { code: 'session_expired' });
  return e;
};
// Transport PGlite : chaque appel s'exécute avec l'identité de la session ; pannes injectables avant ou après le serveur
function pgTransport(session, faults = {}) {
  const as = async () => { const u = session.userId(); if (u) await H.asUser(db, u); else await H.asAnon(db); };
  return {
    push: async (dev, ops, confirm) => {
      if (faults.beforePush && faults.beforePush()) throw netErr();
      await as();
      let r;
      try { r = (await db.query('select api.sync_push($1, $2::jsonb, $3) as r', [dev, JSON.stringify(ops), confirm])).rows[0].r; } catch (e) { throw mapErr(e); }
      if (faults.afterPush && faults.afterPush()) throw netErr(); // le serveur a validé, la réponse est perdue
      return r;
    },
    pull: async (since, max) => {
      if (faults.beforePull && faults.beforePull()) throw netErr();
      await as();
      try { return (await db.query('select api.sync_pull($1, $2) as r', [since, max])).rows[0].r; } catch (e) { throw mapErr(e); }
    }
  };
}
const newDevice = async (uid, label) => {
  await H.asUser(db, uid);
  return (await db.query("insert into app.devices (user_id, label, platform) values ($1, $2, 'web') returning id", [uid, label])).rows[0].id;
};
const device = async (uid, label, faults, storage) => {
  const session = createLocalSession(); session.signIn(uid);
  const id = await newDevice(uid, label);
  const st = storage || memoryStorage();
  return { id, session, storage: st, faults: faults || {}, engine: createSyncEngine({ storage: st, transport: pgTransport(session, faults || {}), session, deviceId: id, pageSize: 10 }) };
};
const lastRev = async uid => { await H.asAdmin(db); const r = await db.query('select last_rev from app.user_sync_state where user_id = $1', [uid]); return r.rows.length ? Number(r.rows[0].last_rev) : 0; };
const serverRow = async (uid, table, id) => { await H.asAdmin(db); return (await db.query(`select * from app.${table} where user_id = $1 and id = $2`, [uid, id])).rows[0]; };
const conflicts = async (uid, id) => { await H.asAdmin(db); return (await db.query('select * from app.sync_conflicts where user_id = $1 and entity_id = $2 order by created_at', [uid, id])).rows; };
const uuid = () => require('crypto').randomUUID();
const U = n => '3333333' + n + '-3333-4333-8333-33333333333' + n;

test.before(async () => { db = await H.freshDb(); await H.createUsers(db, H.USER_A, H.USER_B, U(1), U(2), U(3), U(4), U(5), U(6), U(7), U(8), U(9)); });
test.after(async () => { await db.close(); });

test('T1 et T2 : aucune écriture ni suppression directe sur les tables synchronisées ; lecture limitée à ses lignes', async () => {
  for (const t of H.SYNC_TABLES.concat(['reading_states'])) {
    await H.asUser(db, H.USER_A);
    const ins = await H.tryQuery(db, `insert into app.${t} (user_id, id, data) values ($1, 'direct', '{}')`, [H.USER_A]);
    assert.equal(ins.ok, false, t + ' : insertion directe refusée'); assert.match(ins.error, /permission denied/);
    assert.equal((await H.tryQuery(db, `update app.${t} set data = '{}'`)).ok, false, t + ' : mise à jour directe refusée');
    assert.equal((await H.tryQuery(db, `delete from app.${t}`)).ok, false, t + ' : suppression physique refusée');
  }
  const a = await device(H.USER_A, 'A-iso');
  a.engine.upsert('reading_states', 'loc:x#1@2025', { status: 'read' });
  assert.equal((await a.engine.push()).ok, true);
  await H.asUser(db, H.USER_B);
  assert.equal((await db.query('select * from app.reading_states')).rows.length, 0, 'B ne voit pas les lignes de A');
  assert.equal((await db.query('select api.sync_pull(0, 100) r')).rows[0].r.rows.length, 0, 'sync_pull de B vide');
  await H.asAnon(db);
  assert.equal((await H.tryQuery(db, 'select api.sync_pull(0, 10)')).ok, false, 'anon refusé');
});

test('révisions par champ, ordre par rev, pierre tombale visible, aucune suppression physique', async () => {
  const uid = U(1), a = await device(uid, 'A');
  a.engine.upsert('copies', 's_1', { series: 'Saga', grade: 9.2 });
  a.engine.upsert('copies', 's_2', { series: 'Monstress' });
  await a.engine.push();
  a.engine.upsert('copies', 's_1', { grade: 9.4 });
  a.engine.remove('copies', 's_2');
  await a.engine.push();
  const r1 = await serverRow(uid, 'copies', 's_1');
  assert.equal(Number(r1.field_revs.series), 1); assert.equal(Number(r1.field_revs.grade), 3);
  const r2 = await serverRow(uid, 'copies', 's_2');
  assert.ok(r2, 'ligne conservée'); assert.ok(r2.deleted_at, 'pierre tombale');
  await H.asUser(db, uid);
  const p = (await db.query('select api.sync_pull(0, 100) r')).rows[0].r;
  const revs = p.rows.map(r => Number(r.rev));
  assert.deepEqual(revs, revs.slice().sort((x, y) => x - y)); assert.ok(p.rows.some(r => r.id === 's_2' && r.deleted_at));
});

test('idempotence : un op_id rejoué renvoie le résultat enregistré, sans nouvelle révision', async () => {
  const uid = U(2), dev = await newDevice(uid, 'A');
  const op = { op_id: uuid(), entity: 'copies', id: 's_1', kind: 'upsert', base_rev: 0, patch: { series: 'X' } };
  await H.asUser(db, uid);
  const r1 = (await db.query('select api.sync_push($1, $2::jsonb) r', [dev, JSON.stringify([op])])).rows[0].r;
  const rev = await lastRev(uid);
  await H.asUser(db, uid);
  const r2 = (await db.query('select api.sync_push($1, $2::jsonb) r', [dev, JSON.stringify([op, op])])).rows[0].r;
  assert.equal(r1.results[0].status, 'applied');
  assert.deepEqual(r2.results.map(x => x.status), ['duplicate', 'duplicate']);
  assert.equal(await lastRev(uid), rev, 'aucune nouvelle révision');
});

test('V4 : réponse perdue après validation — le même lot est rejoué, aucune double application', async () => {
  const uid = U(3);
  let lose = true;
  const a = await device(uid, 'A', { afterPush: () => { const l = lose; lose = false; return l; } });
  for (let i = 0; i < 5; i++) a.engine.upsert('copies', 's_' + i, { n: i });
  const ids0 = a.engine.state().outbox.map(o => o.op_id);
  const p1 = await a.engine.push();
  assert.equal(p1.ok, false); assert.equal(p1.reason, 'network'); assert.equal(a.engine.pending(), 5, 'outbox intacte');
  assert.deepEqual(a.engine.state().outbox.map(o => o.op_id), ids0, 'mêmes op_id');
  const rev = await lastRev(uid);
  const p2 = await a.engine.push();
  assert.equal(p2.ok, true); assert.equal(p2.duplicate, 5); assert.equal(await lastRev(uid), rev);
});

test('V1 : deux appareils, champs différents d\'un même exemplaire — fusion sans conflit, convergence', async () => {
  const uid = U(4), a = await device(uid, 'A'), b = await device(uid, 'B');
  a.engine.upsert('copies', 's_1', { series: 'Saga', grade: 9.0, notes: '' });
  await a.engine.sync(); await b.engine.sync();
  a.engine.upsert('copies', 's_1', { grade: 9.6 });
  b.engine.upsert('copies', 's_1', { notes: 'signé' });
  await a.engine.sync();
  const rb = await b.engine.push();
  assert.equal(rb.merged, 1); assert.equal(rb.conflict || 0, 0);
  await b.engine.sync(); await a.engine.sync();
  assert.deepEqual(a.engine.fingerprint(), b.engine.fingerprint());
  assert.equal(a.engine.local('copies', 's_1').data.grade, 9.6); assert.equal(a.engine.local('copies', 's_1').data.notes, 'signé');
  assert.equal((await conflicts(uid, 's_1')).length, 0);
});

test('V2 et règle financière : même champ — premier écrit gagnant, conflit consigné, un null ne remplace jamais une valeur connue', async () => {
  const uid = U(5), a = await device(uid, 'A'), b = await device(uid, 'B');
  a.engine.upsert('copies', 's_1', { grade: 9.0, purchasePrice: null });
  await a.engine.sync(); await b.engine.sync();
  a.engine.upsert('copies', 's_1', { grade: 9.8, purchasePrice: 12 });
  b.engine.upsert('copies', 's_1', { grade: 8.5, purchasePrice: null });
  await a.engine.sync();
  const rb = await b.engine.push();
  assert.equal(rb.conflict, 1);
  const row = await serverRow(uid, 'copies', 's_1');
  assert.equal(row.data.grade, 9.8, 'premier écrit gagnant'); assert.equal(row.data.purchasePrice, 12, 'le prix connu reste');
  const c = await conflicts(uid, 's_1');
  assert.deepEqual(c.map(x => x.field).sort(), ['grade', 'purchasePrice'], 'deux champs concurrents consignés');
  await b.engine.sync(); await a.engine.sync();
  assert.deepEqual(a.engine.fingerprint(), b.engine.fingerprint());
});

test('null concurrent d\'une valeur connue : conflit visible, rien n\'est effacé', async () => {
  const uid = U(6), a = await device(uid, 'A'), b = await device(uid, 'B');
  a.engine.upsert('copies', 's_1', { purchasePrice: 5 });
  await a.engine.sync(); await b.engine.sync();
  a.engine.upsert('copies', 's_1', { purchasePrice: 7 });
  b.engine.upsert('copies', 's_1', { purchasePrice: null });
  await a.engine.sync(); await b.engine.push();
  assert.equal((await serverRow(uid, 'copies', 's_1')).data.purchasePrice, 7);
  const c = await conflicts(uid, 's_1');
  assert.equal(c.length, 1); assert.equal(c[0].local_value, null); assert.equal(Number(c[0].server_value), 7);
});

test('V6 : suppression contre modification — la modification gagne dans les deux ordres, la suppression est consignée', async () => {
  const uid = U(7), a = await device(uid, 'A'), b = await device(uid, 'B');
  a.engine.upsert('copies', 's_1', { series: 'X' }); a.engine.upsert('copies', 's_2', { series: 'Y' });
  await a.engine.sync(); await b.engine.sync();
  // Ordre 1 : A supprime d'abord, B modifie ensuite → résurrection
  a.engine.remove('copies', 's_1'); await a.engine.push();
  b.engine.upsert('copies', 's_1', { grade: 9 }); await b.engine.push();
  const r1 = await serverRow(uid, 'copies', 's_1');
  assert.equal(r1.deleted_at, null); assert.equal(r1.data.grade, 9);
  assert.ok((await conflicts(uid, 's_1')).some(c => c.field === '__deleted' && c.resolution === 'resurrected'));
  // Ordre 2 : B modifie d'abord, A supprime ensuite sur une base ancienne → la modification est gardée
  b.engine.upsert('copies', 's_2', { grade: 8 }); await b.engine.push();
  a.engine.remove('copies', 's_2'); const ra = await a.engine.push();
  assert.equal(ra.conflict, 1);
  assert.equal((await serverRow(uid, 'copies', 's_2')).deleted_at, null);
  assert.ok((await conflicts(uid, 's_2')).some(c => c.resolution === 'modification_kept'));
  await a.engine.sync(); await b.engine.sync(); await a.engine.sync();
  assert.deepEqual(a.engine.fingerprint(), b.engine.fingerprint());
});

test('V11 et V13 : réception interrompue puis reprise après redémarrage, sans doublon ni trou ; outbox conservée', async () => {
  const uid = U(8), a = await device(uid, 'A');
  for (let i = 0; i < 25; i++) a.engine.upsert('copies', 'p_' + i, { n: i });
  await a.engine.push();
  const st = memoryStorage();
  const b = await device(uid, 'B', {}, st);
  b.engine.upsert('locations', 'loc_1', { name: 'Boîte 1' }); // modification locale en attente
  const part = await b.engine.pull({ maxPages: 1 });
  assert.equal(part.partial, true); assert.equal(part.received, 10);
  // « Fermeture de l'onglet » : un nouveau moteur recharge l'état enregistré
  const b2 = createSyncEngine({ storage: st, transport: pgTransport(b.session), session: b.session, deviceId: b.id, pageSize: 10 });
  assert.equal(b2.pending(), 1, 'outbox conservée au redémarrage');
  const rest = await b2.pull();
  assert.equal(rest.received, 15, 'reprise à la page suivante');
  assert.equal(Object.keys(b2.fingerprint().copies).length, 25);
  await b2.sync(); await a.engine.sync();
  assert.deepEqual(a.engine.fingerprint(), b2.fingerprint());
});

test('V3 et V10 : session expirée — arrêt propre, outbox intacte ; outbox jamais envoyée par un autre compte', async () => {
  const uid = U(9), a = await device(uid, 'A');
  a.engine.upsert('copies', 's_1', { series: 'X' });
  a.session.expire();
  const p = await a.engine.push();
  assert.equal(p.reason, 'session_expired'); assert.equal(a.engine.pending(), 1);
  a.session.signIn(uid);
  assert.equal((await a.engine.push()).ok, true);
  // Changement de compte sur le même appareil : l'outbox de l'ancien compte est mise en quarantaine, pas envoyée
  a.engine.upsert('copies', 's_secret', { series: 'Privé' });
  a.session.signIn(H.USER_B);
  const devB = await newDevice(H.USER_B, 'A pour B');
  const eB = createSyncEngine({ storage: a.storage, transport: pgTransport(a.session), session: a.session, deviceId: devB });
  await eB.push();
  assert.equal(eB.state().quarantine.length, 1); assert.equal(eB.state().quarantine[0].outbox.length, 1);
  await H.asAdmin(db);
  assert.equal((await db.query("select count(*)::int n from app.copies where id = 's_secret'")).rows[0].n, 0, 'rien envoyé');
});

test('V12 : appareil révoqué — envoi refusé, données locales intactes et exportables', async () => {
  const a = await device(H.USER_A, 'A-rev');
  a.engine.upsert('copies', 's_r', { series: 'X' });
  await H.asAdmin(db);
  await db.query('update app.devices set revoked_at = now() where id = $1', [a.id]);
  const p = await a.engine.push();
  assert.equal(p.reason, 'device_revoked'); assert.equal(a.engine.pending(), 1);
  assert.equal(a.engine.state().rows['copies|s_r'].data.series, 'X');
});

test('V14 : un client ancien ne supprime jamais un champ qu\'il ignore', async () => {
  const a = await device(H.USER_A, 'A-new'), b = await device(H.USER_A, 'B-old');
  a.engine.upsert('copies', 's_f', { series: 'X', futureField: { v: 2 } });
  await a.engine.sync(); await b.engine.sync();
  b.engine.upsert('copies', 's_f', { series: 'X2' });
  await b.engine.push();
  const r = await serverRow(H.USER_A, 'copies', 's_f');
  assert.deepEqual(r.data.futureField, { v: 2 }); assert.equal(r.data.series, 'X2');
});

test('garde-fou : plus de 50 suppressions exigent une confirmation (client et serveur)', async () => {
  const a = await device(H.USER_B, 'B-mass');
  for (let i = 0; i < 51; i++) a.engine.upsert('pulls', 'pl_' + i, { n: i });
  await a.engine.push();
  for (let i = 0; i < 51; i++) a.engine.remove('pulls', 'pl_' + i);
  assert.equal((await a.engine.push()).reason, 'needs_confirmation');
  await H.asUser(db, H.USER_B);
  const raw = (await db.query('select api.sync_push($1, $2::jsonb) r', [a.id, JSON.stringify(a.engine.state().outbox)])).rows[0].r;
  assert.equal(raw.status, 'needs_confirmation');
  await H.asAdmin(db);
  assert.equal((await db.query("select count(*)::int n from app.pulls where user_id = $1 and deleted_at is not null", [H.USER_B])).rows[0].n, 0);
  assert.equal((await a.engine.push({ confirmMassDelete: true })).ok, true);
  await H.asAdmin(db);
  assert.equal((await db.query("select count(*)::int n from app.pulls where user_id = $1 and deleted_at is not null", [H.USER_B])).rows[0].n, 51);
});

test('lot invalide : tout ou rien, aucune écriture', async () => {
  const dev = await newDevice(H.USER_B, 'B-inv');
  const before = await lastRev(H.USER_B);
  await H.asUser(db, H.USER_B);
  const bad = await H.tryQuery(db, 'select api.sync_push($1, $2::jsonb)', [dev, JSON.stringify([
    { op_id: uuid(), entity: 'copies', id: 'ok_1', kind: 'upsert', base_rev: 0, patch: { a: 1 } },
    { op_id: 'pas-un-uuid', entity: 'copies', id: 'ok_2', kind: 'upsert', base_rev: 0, patch: {} }])]);
  assert.equal(bad.ok, false); assert.match(bad.error, /invalid_op/);
  for (const ops of [[{ op_id: uuid(), entity: 'profiles', id: 'x', kind: 'upsert', patch: {} }], [{ op_id: uuid(), entity: 'copies', id: 'x', kind: 'truncate' }], new Array(201).fill(0).map(() => ({ op_id: uuid(), entity: 'copies', id: 'x', kind: 'delete' })), { not: 'array' }]) {
    await H.asUser(db, H.USER_B);
    assert.equal((await H.tryQuery(db, 'select api.sync_push($1, $2::jsonb)', [dev, JSON.stringify(ops)])).ok, false);
  }
  assert.equal(await lastRev(H.USER_B), before);
  await H.asUser(db, H.USER_B);
  assert.equal((await H.tryQuery(db, 'select api.sync_push($1, $2::jsonb)', ['00000000-0000-4000-8000-000000000000', '[]'])).ok, false, 'appareil inconnu refusé');
});

test('T4 : app.skip_rev ignorée pour un client, honorée pour le service ; horizon de purge → resynchronisation', async () => {
  const a = await device(H.USER_B, 'B-skip');
  a.engine.upsert('copies', 's_skip', { v: 1 }); await a.engine.push();
  const r0 = Number((await serverRow(H.USER_B, 'copies', 's_skip')).rev);
  await H.asUser(db, H.USER_B);
  await db.exec("set app.skip_rev = 'on'");
  await db.query('select api.sync_push($1, $2::jsonb)', [a.id, JSON.stringify([{ op_id: uuid(), entity: 'copies', id: 's_skip', kind: 'upsert', base_rev: r0, patch: { v: 2 } }])]);
  const r1 = Number((await serverRow(H.USER_B, 'copies', 's_skip')).rev);
  assert.ok(r1 > r0, 'révision attribuée malgré skip_rev côté client');
  await H.asAdmin(db);
  await db.query("update app.copies set data = data || '{\"v\": 3}' where user_id = $1 and id = 's_skip'", [H.USER_B]);
  assert.equal(Number((await serverRow(H.USER_B, 'copies', 's_skip')).rev), r1, 'migration de service sans nouvelle révision');
  await db.exec("reset app.skip_rev");
  await db.query('update app.user_sync_state set purged_below_rev = 5 where user_id = $1', [H.USER_B]);
  await H.asUser(db, H.USER_B);
  assert.equal((await db.query('select api.sync_pull(0, 10) r')).rows[0].r.status, 'resync_required');
  await H.asAdmin(db);
  await db.query('update app.user_sync_state set purged_below_rev = 0 where user_id = $1', [H.USER_B]);
});

test('multi-appareils : 3 appareils, 150 opérations aléatoires avec coupures, convergence complète', async () => {
  const uid = '44444444-4444-4444-8444-444444444444';
  await H.createUsers(db, uid);
  let seed = 42; const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  const devs = [];
  for (const l of ['A', 'B', 'C']) devs.push(await device(uid, l, { beforePush: () => rnd(5) === 0, afterPush: () => rnd(7) === 0, beforePull: () => rnd(6) === 0 }));
  for (let i = 0; i < 150; i++) {
    const d = devs[rnd(3)], id = 's_' + rnd(12), act = rnd(10);
    if (act < 7) d.engine.upsert('copies', id, { ['f' + rnd(4)]: rnd(100) });
    else if (act < 8) d.engine.remove('copies', id);
    else await d.engine.sync();
  }
  // Fin des coupures, synchronisation finale
  devs.forEach(d => { d.faults.beforePush = d.faults.afterPush = d.faults.beforePull = () => false; });
  for (let round = 0; round < 3; round++) for (const d of devs) await d.engine.sync();
  for (const d of devs) assert.equal(d.engine.pending(), 0);
  const fp = devs[0].engine.fingerprint();
  assert.deepEqual(devs[1].engine.fingerprint(), fp); assert.deepEqual(devs[2].engine.fingerprint(), fp);
  await H.asAdmin(db);
  const server = (await db.query('select id, data from app.copies where user_id = $1 and deleted_at is null order by id', [uid])).rows;
  assert.equal(server.length, (fp.copies || []).length, 'le serveur et les appareils ont les mêmes fiches');
});
