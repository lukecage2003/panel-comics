'use strict';
// Lot 3.3 (local, D-38) : rôles serveur sans accès aux données personnelles (A10), profil, préférences HLC, appareils.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness');

let db;
test.before(async () => { db = await H.freshDb(); await H.createUsers(db, H.USER_A, H.USER_B); });
test.after(async () => { if (db) await db.close(); });

const q1 = async (sql, p) => (await db.query(sql, p)).rows[0];
const hlc = (ms, c, dev) => String(ms).padStart(13, '0') + '-' + String(c).padStart(4, '0') + '-' + dev;
const uuid = () => require('crypto').randomUUID();

test('rôles : attribution réservée au service, journalisée, idempotente ; has_role et my_roles', async () => {
  await H.asUser(db, H.USER_A);
  assert.equal((await q1("select app.has_role('admin') r")).r, false);
  await assert.rejects(db.query("select app.grant_role($1, 'admin', 'moi')", [H.USER_A]), /permission denied/);
  await assert.rejects(db.query("insert into app.staff_roles (user_id, role, granted_by) values ($1, 'admin', 'moi')", [H.USER_A]), /permission denied/);
  await H.asAdmin(db);
  await assert.rejects(db.query("select app.grant_role($1, 'superuser', 'service')", [H.USER_A]), /invalid_role/);
  assert.equal((await q1("select app.grant_role($1, 'admin', 'service', 'test') r", [H.USER_A])).r.status, 'granted');
  assert.equal((await q1("select app.grant_role($1, 'admin', 'service') r", [H.USER_A])).r.status, 'unchanged');
  await db.query("select app.grant_role($1, 'moderator', 'service')", [H.USER_A]);
  assert.equal((await q1('select count(*)::int n from app.staff_role_log where user_id = $1', [H.USER_A])).n, 2);
  await H.asUser(db, H.USER_A);
  assert.equal((await q1("select app.has_role('admin') r")).r, true);
  assert.equal((await q1("select app.has_role('editor') r")).r, false);
  assert.deepEqual((await q1('select api.my_roles() r')).r, ['admin', 'moderator']);
  await assert.rejects(db.query("delete from app.staff_roles where user_id = $1", [H.USER_A]), /permission denied/);
  await assert.rejects(db.query('select * from app.staff_role_log'), /permission denied/);
  await H.asUser(db, H.USER_B);
  assert.equal((await q1("select app.has_role('admin') r")).r, false);
  assert.equal((await q1('select count(*)::int n from app.staff_roles')).n, 0, 'B ne voit pas les rôles de A');
  await H.asAnon(db);
  await assert.rejects(db.query("select app.has_role('admin')"), /permission denied/);
});

test('frontière A10 : un administrateur ne lit ni ne modifie aucune donnée personnelle d\'autrui', async () => {
  await H.asAdmin(db);
  for (const t of H.APP_TABLES) { const s = H.sampleRow(t, H.USER_B, 7); await H.tryQuery(db, s.sql, s.params); }
  const pol = (await db.query("select count(*)::int n from pg_policies where schemaname = 'app' and (qual ilike '%has_role%' or with_check ilike '%has_role%' or qual ilike '%staff_roles%')")).rows[0].n;
  assert.equal(pol, 0, 'aucune politique de app.* ne dépend d\'un rôle');
  await H.asUser(db, H.USER_A);
  assert.equal((await q1("select app.has_role('admin') r")).r, true);
  for (const t of H.APP_TABLES) {
    const r = await H.tryQuery(db, `select count(*)::int n from app.${t} where user_id = $1`, [H.USER_B]);
    if (r.ok) assert.equal(r.rows[0].n, 0, `${t} : aucune ligne de B visible pour un admin`);
    const u = await H.tryQuery(db, `update app.${t} set user_id = user_id where user_id = $1`, [H.USER_B]);
    if (u.ok) assert.equal(u.affected || 0, 0, `${t} : aucune modification de B`);
  }
  const ex = (await q1('select api.export_my_data() r')).r;
  assert.ok(!JSON.stringify(ex).includes(H.USER_B), 'export de l\'admin sans données de B');
});

test('profil : lecture crée le profil privé, champs autorisés seulement, valeurs contrôlées', async () => {
  await H.asUser(db, H.USER_B);
  const p = (await q1('select api.my_profile() r')).r;
  assert.equal(p.locale, 'fr');
  assert.equal(p.privacy.profile_public, false, 'tout privé par défaut');
  const u = (await q1('select api.update_profile($1::jsonb) r', [JSON.stringify({ display_name: '  Lecteur B  ', preferred_market: 'US', locale: 'en' })])).r;
  assert.deepEqual([u.display_name, u.preferred_market, u.locale], ['Lecteur B', 'US', 'en']);
  await assert.rejects(db.query('select api.update_profile($1::jsonb)', [JSON.stringify({ handle: 'pirate' })]), /invalid_profile_field/);
  await assert.rejects(db.query('select api.update_profile($1::jsonb)', [JSON.stringify({ locale: 'xx' })]), /invalid_locale/);
  await assert.rejects(db.query('select api.update_profile($1::jsonb)', [JSON.stringify({ preferred_market: 'JP' })]), /invalid_market/);
  await H.asAnon(db);
  await assert.rejects(db.query('select api.my_profile()'), /permission denied/);
});

test('appareils et préférences : A visible sur B, horloge plus ancienne ignorée, valeur identique sans écriture, révocation', async () => {
  await H.asUser(db, H.USER_B);
  const dA = (await q1("select api.register_device('Ordinateur', 'web', '2026.11') id")).id;
  const dB = (await q1("select api.register_device('Téléphone', 'android') id")).id;
  await assert.rejects(db.query("select api.register_device('x', 'ios')"), /invalid_platform/);
  const t0 = Date.UTC(2026, 10, 10);
  const merge = (dev, prefs, h) => q1('select api.settings_merge($1, $2::jsonb, $3::jsonb) r', [dev, JSON.stringify(prefs), JSON.stringify(h)]).then(x => x.r);
  let r = await merge(dA, { theme: 'dark', view: 'grid' }, { theme: hlc(t0, 0, 'a'), view: hlc(t0, 0, 'a') });
  assert.deepEqual(r.applied.sort(), ['theme', 'view']);
  const s = await q1('select api.settings_get() r');
  assert.equal(s.r.prefs.theme, 'dark', 'modification de A visible depuis B');
  r = await merge(dB, { theme: 'light' }, { theme: hlc(t0 - 5000, 0, 'b') });
  assert.deepEqual(r.ignored, ['theme']);
  assert.equal(r.prefs.theme, 'dark', 'horloge plus ancienne : rien n\'est écrasé');
  const rev1 = Number(r.rev);
  r = await merge(dB, { theme: 'dark' }, { theme: hlc(t0 + 1000, 0, 'b') });
  assert.deepEqual(r.applied, [], 'valeur identique : non appliquée');
  r = await merge(dB, { theme: 'dark' }, { theme: hlc(t0 + 1000, 0, 'b') });
  assert.deepEqual(r.ignored, ['theme'], 'même horloge rejouée : ignorée (pas de boucle)');
  assert.ok(Number(r.rev) <= rev1 + 1, 'au plus une révision pour l\'avance d\'horloge');
  r = await merge(dB, { theme: 'lime', sounds: false }, { theme: hlc(t0 + 2000, 0, 'b'), sounds: hlc(t0 + 2000, 0, 'b') });
  assert.equal(r.prefs.theme, 'lime'); assert.equal(r.prefs.view, 'grid', 'clé non transmise conservée'); assert.equal(r.prefs.sounds, false);
  await assert.rejects(merge(dB, { theme: 'x' }, { theme: 'pas-une-horloge' }), /invalid_hlc/);
  await assert.rejects(merge(dB, { theme: 'x' }, {}), /invalid_hlc/);
  // Révocation : définitive, serveur seulement ; l'appareil révoqué est refusé par settings_merge et sync_push
  assert.equal((await q1('select api.revoke_device($1) r', [dB])).r.status, 'revoked');
  assert.equal((await q1('select api.revoke_device($1) r', [dB])).r.status, 'already_revoked');
  await assert.rejects(merge(dB, { theme: 'x' }, { theme: hlc(t0 + 9000, 0, 'b') }), /device_revoked/);
  await assert.rejects(db.query('select api.sync_push($1, $2::jsonb, false)', [dB, JSON.stringify([{ op_id: uuid(), entity: 'copies', id: 'c_1', kind: 'upsert', base_rev: 0, patch: { series: 'X' }, schema_version: 1 }])]), /device_revoked|revoked/);
  await assert.rejects(db.query('update app.devices set revoked_at = null where id = $1', [dB]), /permission denied/);
  const list = (await q1('select api.list_devices() r')).r;
  assert.equal(list.filter(d => d.id === dA || d.id === dB).length, 2);
  assert.equal(list.find(d => d.id === dB).revoked, true);
  assert.equal(list.find(d => d.id === dA).revoked, false);
  await H.asUser(db, H.USER_A);
  await assert.rejects(db.query('select api.revoke_device($1)', [dA]), /unknown_device/, 'A ne révoque pas l\'appareil de B');
  await assert.rejects(merge(dA, { theme: 'x' }, { theme: hlc(t0 + 9000, 0, 'a') }), /unknown_device/, 'A n\'utilise pas l\'appareil de B');
  assert.equal((await q1('select api.list_devices() r')).r.filter(d => d.id === dA).length, 0);
});
