'use strict';
// D-102 (migration 16, préparée) : mots interdits et file de modération enrichie. Base PGlite, rôles non privilégiés.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness');

const AUTHOR = H.USER_A, R1 = H.USER_B;
const R2 = '66666666-6666-4666-8666-666666666666', R3 = '77777777-7777-4777-8777-777777777777', MOD = '88888888-8888-4888-8888-888888888888';

let db, rude, calm, worse;
const q1 = async (sql, p) => (await db.query(sql, p)).rows[0];
const as = uid => H.asUser(db, uid);
test.before(async () => {
  db = await H.freshDb();
  await H.createUsers(db, AUTHOR, R1, R2, R3, MOD);
  const join = async (u, h) => { await as(u); await db.query('select api.community_join($1, $2)', [h, 1990]); };
  await join(AUTHOR, 'auteur_m'); await join(R1, 'lecteur_un'); await join(R2, 'lecteur_deux'); await join(R3, 'lecteur_trois'); await join(MOD, 'moderateur');
  await as(AUTHOR);
  rude = (await q1("select api.post_create('story', 'Quel 1D10T ce scénariste', '{}', 'public') id")).id;
  calm = (await q1("select api.post_create('story', 'Belle couverture', '{}', 'public') id")).id;
  worse = (await q1("select api.post_create('story', 'Texte signalé pour un mineur', '{}', 'public') id")).id;
  await as(R1); await db.query("select api.report('post', $1, 'spam')", [calm]); await db.query("select api.report('post', $1, 'spam')", [rude]);
  await as(R2); await db.query("select api.report('post', $1, 'spam')", [calm]);
  await H.asAdmin(db); await db.query("select app.grant_role($1, 'moderator', 'service', 'test')", [MOD]);
});
test.after(async () => { if (db) await db.close(); });

test('mots interdits : réservés à l\'équipe, liste nettoyée et journalisée', async () => {
  await as(R1);
  await assert.rejects(db.query('select api.mod_terms_get()'), /forbidden/);
  await assert.rejects(db.query("select api.mod_terms_set(array['idiot'])"), /forbidden/);
  await as(MOD);
  const r = (await q1("select api.mod_terms_set(array['idiot', ' idiot ', 'x', 'gros mot']) r")).r;
  assert.equal(r.count, 2);
  assert.deepEqual((await q1('select api.mod_terms_get() t')).t, ['gros mot', 'idiot']);
  await assert.rejects(db.query('select api.mod_terms_set($1)', [Array.from({ length: 301 }, (_, i) => 'mot' + i)]), /too_many/);
});

test('file enrichie : texte, auteur, mot interdit trouvé (chiffres déguisés compris), sans rien retirer', async () => {
  await as(MOD);
  const q = (await q1('select api.mod_queue2() q')).q;
  const hit = q.find(x => x.target_id === rude), plain = q.find(x => x.target_id === calm);
  assert.equal(hit.term_hit, 'idiot');
  assert.equal(hit.author_id, AUTHOR);
  assert.match(hit.text, /1D10T/);
  assert.equal(plain.term_hit, null);
  assert.equal(q[0].target_id, rude, 'à gravité égale, le mot interdit passe devant');
  await H.asAdmin(db);
  assert.equal((await q1('select status from community.posts where id = $1', [rude])).status, 'visible', 'jamais retiré automatiquement');
  await as(R3); await db.query("select api.report('post', $1, 'minor_safety')", [worse]);
  await as(MOD);
  assert.equal((await q1('select api.mod_queue2() q')).q[0].target_id, worse, 'sécurité des mineurs en tête');
});

test('délais : médiane des décisions, signalements en retard', async () => {
  await as(MOD);
  await db.query("select api.mod_act('post', $1, 'dismiss', 'Classé sans suite')", [calm]);
  const s = (await q1('select api.mod_stats() s')).s;
  assert.equal(typeof s.median_min, 'number');
  assert.equal(s.late, 0);
  await H.asAdmin(db); await db.query("update community.reports set created_at = now() - interval '2 hours' where target_id = $1", [worse]);
  await as(MOD);
  assert.equal((await q1('select api.mod_stats() s')).s.late, 1, 'mineur : une heure au plus');
  await as(R1); await assert.rejects(db.query('select api.mod_stats()'), /forbidden/);
});

test('api.mod_queue d\'origine inchangée', async () => {
  await as(MOD);
  const q = (await q1('select api.mod_queue() q')).q;
  assert.ok(q.length >= 2 && !('term_hit' in q[0]));
});
