'use strict';
// D-117 (migration 22) : chaque clé étrangère des schémas de Panel a un index qui la couvre. Base PGlite locale.
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./harness');

let db;
test.before(async () => { db = await H.freshDb(); });
test.after(async () => { if (db) await db.close(); });

test('aucune clé étrangère sans index couvrant', async () => {
  await H.asAdmin(db);
  const r = await db.query(`select n.nspname || '.' || t.relname || '.' || c.conname as fk
    from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace
    where c.contype = 'f' and n.nspname in ('app', 'billing', 'community', 'forum', 'guardian', 'market', 'messaging', 'pro')
      and not exists (select 1 from pg_index i where i.indrelid = t.oid
        and (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1] @> c.conkey and c.conkey @> (i.indkey::int2[])[0:array_length(c.conkey, 1) - 1])`);
  assert.deepEqual(r.rows.map(x => x.fk), []);
});
