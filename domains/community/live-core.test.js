'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('./live-core');

const T0 = '2026-11-14T18:00:00.000Z';
const at = s => new Date(Date.parse(T0) + s * 1000).toISOString();
const input = { title: '  Le meilleur run de   Daredevil ', format: 'bestrun', when: '2026-11-19T19:30:00Z', topics: 'Miller\n\nBendis et Maleev\nZdarsky', images: [{ ref: 'c1', series: 'Série fictive', issue: '#1' }, { ref: 'c1', series: 'doublon' }, { ref: '', series: 'sans référence' }] };

test('saveRoom : nettoyage, règles par défaut, validation', () => {
  const r = L.saveRoom(L.emptyState(), input, T0, 'lv_1');
  assert.deepEqual(r.errors, []);
  assert.equal(r.room.title, 'Le meilleur run de Daredevil');
  assert.deepEqual(r.room.topics, ['Miller', 'Bendis et Maleev', 'Zdarsky']);
  assert.equal(r.room.images.length, 1);
  assert.equal(r.room.images[0].kind, 'copy');
  assert.deepEqual(r.room.rules, L.DEFAULT_RULES.slice());
  assert.equal(r.state.rooms.length, 1);
  const bad = L.saveRoom(r.state, { title: '', topics: '' }, T0, 'lv_2');
  assert.equal(bad.errors.length, 2);
  assert.equal(bad.state.rooms.length, 1);
  // Mise à jour : même identifiant, date de création conservée
  const up = L.saveRoom(r.state, { id: 'lv_1', title: 'Daredevil, le procès' }, at(60), 'ignored');
  assert.equal(up.state.rooms.length, 1);
  assert.equal(up.room.createdAt, T0);
  assert.equal(up.room.title, 'Daredevil, le procès');
  assert.deepEqual(up.room.topics, ['Miller', 'Bendis et Maleev', 'Zdarsky']);
});

test('ordered : directs à venir d\'abord, puis brouillons, puis passés', () => {
  let st = L.emptyState();
  st = L.saveRoom(st, { title: 'Passé', topics: 'a', when: '2026-11-01T10:00:00Z' }, T0, 'p').state;
  st = L.saveRoom(st, { title: 'Brouillon', topics: 'a' }, T0, 'b').state;
  st = L.saveRoom(st, { title: 'Loin', topics: 'a', when: '2026-12-20T10:00:00Z' }, T0, 'l').state;
  st = L.saveRoom(st, { title: 'Proche', topics: 'a', when: '2026-11-15T10:00:00Z' }, T0, 'c').state;
  assert.deepEqual(L.ordered(st, T0).map(x => x.id), ['c', 'l', 'b', 'p']);
  assert.equal(L.removeRoom(st, 'b').state.rooms.length, 3);
});

test('répétition : sujets chronométrés, images montrées, réactions de l\'utilisateur, synthèse', () => {
  const { state, room } = L.saveRoom(L.emptyState(), input, T0, 'lv_1');
  let s = L.startSession(room, T0);
  s = L.showImage(s, room, 'c1');
  s = L.showImage(s, room, 'inconnue');
  s = L.react(s, 'POW!'); s = L.react(s, 'POW!'); s = L.react(s, 'faux');
  s = L.nextTopic(s, room, at(90));
  s = L.showImage(s, room, 'c1');
  assert.equal(s.shown, null);
  const end = L.endSession(state, s, room, at(150), 'h_1');
  assert.equal(end.summary.durationSec, 150);
  assert.deepEqual(end.summary.topics, [{ text: 'Miller', secs: 90 }, { text: 'Bendis et Maleev', secs: 60 }]);
  assert.deepEqual(end.summary.shown.map(x => x.ref), ['c1']);
  assert.deepEqual(end.summary.reactions, { 'POW!': 2 });
  assert.equal(end.state.history.length, 1);
  assert.match(L.summaryText(end.summary), /Meilleur run : Le meilleur run de Daredevil\nAu programme : Miller · Bendis et Maleev\nDurée : 2 min 30 s/);
});

test('sanitizeState rejette le mal formé ; formats de durée', () => {
  const st = L.sanitizeState({ rooms: [{ id: 'x', title: '<b>ok</b>', topics: ['a'], format: 'piège' }, { id: 'x', title: 'doublon', topics: ['a'] }, null, { title: 'sans id' }], history: [{ id: 'h', durationSec: -5, reactions: { 'POW!': 'x', 'WOW!': 3 } }] });
  assert.equal(st.rooms.length, 1);
  assert.equal(st.rooms[0].format, 'free');
  assert.equal(st.history[0].durationSec, 0);
  assert.deepEqual(st.history[0].reactions, { 'WOW!': 3 });
  assert.equal(L.fmtDuration(3725), '1 h 02 min');
  assert.equal(L.fmtDuration(65), '1 min 05 s');
  assert.equal(L.clock(605), '10:05');
});

test('pages de la galerie : références seulement, plafond, navigation, planche sans image', () => {
  const pages = Array.from({ length: 20 }, (_, i) => ({ ref: 'pg_' + i, kind: 'page', caption: 'Page fictive ' + i, spoiler: i === 0, dataUrl: 'data:image/jpeg;base64,xxx' }));
  const r = L.saveRoom(L.emptyState(), { title: 'Pages', topics: 'a', images: [{ ref: 'c1', series: 'Série fictive', issue: '#1' }].concat(pages) }, T0, 'lv_p');
  assert.equal(r.room.images.filter(L.isPage).length, L.LIMITS.pages);
  assert.equal(r.room.images.length, 1 + L.LIMITS.pages);
  assert.deepEqual(r.room.images[1], { ref: 'pg_0', kind: 'page', caption: 'Page fictive 0', spoiler: true });
  assert.equal(L.imageLabel(r.room.images[0]), 'Série fictive #1');
  assert.equal(L.imageLabel({ kind: 'page', caption: '' }), 'Page de la galerie');
  let s = L.startSession(r.room, T0);
  s = L.stepImage(s, r.room, 1); assert.equal(s.shown, 'c1');
  s = L.stepImage(s, r.room, 1); assert.equal(s.shown, 'pg_0');
  s = L.stepImage(s, r.room, -1); s = L.stepImage(s, r.room, -1); assert.equal(s.shown, r.room.images[r.room.images.length - 1].ref);
  const end = L.endSession(r.state, s, r.room, at(30), 'h_p');
  assert.ok(end.summary.shown.some(L.isPage));
  assert.match(L.summaryText(end.summary), /pages? commentées?/);
  assert.ok(!/pg_|data:/.test(L.summaryText(end.summary)));
  const refs = L.pageRefs(end.state);
  assert.ok(refs.includes('pg_0') && refs.includes('pg_15') && !refs.includes('pg_19'));
});

test('duel en direct : camps, manches, preuves par camp, vote et chat de l\'utilisateur seul', () => {
  const L = require('./live-core');
  const now = '2026-11-20T20:00:00Z';
  const r = L.saveRoom(L.emptyState(), { title: 'Absolute Batman ou Ultimate Spider-Man ?', format: 'duel', duel: { sides: ['Absolute Batman', ''] },
    images: [{ ref: 'a', kind: 'copy', series: 'X', issue: '#1', side: 0 }, { ref: 'b', kind: 'page', caption: 'p. 3', side: 1 }, { ref: 'c', kind: 'copy', side: 7 }] }, now, 'lv1');
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.room.duel.sides, ['Absolute Batman', 'Contre']);
  assert.equal(r.room.images[2].side, undefined);
  let s = L.startSession(r.room, now);
  assert.equal(L.roundOf(s).label, 'Ouverture');
  s = L.showImage(s, r.room, 'a'); s = L.showImage(s, r.room, 'b'); s = L.showImage(s, r.room, 'c');
  assert.deepEqual(L.evidenceCount(s, r.room), [1, 1]);
  for (let i = 0; i < 6; i++) s = L.nextRound(s, r.room, now);
  assert.equal(L.roundOf(s).key, 'vote');
  s = L.castVote(s, 1); assert.equal(s.vote, 1);
  s = L.castVote(s, 1); assert.equal(s.vote, null);
  s = L.castVote(s, 0);
  s = L.sendChat(s, '   ', now); assert.equal(s.chat.length, 0);
  s = L.sendChat(s, 'Preuve page 3 !', now); assert.equal(s.chat[0].by, 'me');
  const end = L.endSession(r.state, s, r.room, now, 'h1');
  assert.deepEqual(end.summary.duel, { sides: ['Absolute Batman', 'Contre'], vote: 0, rounds: 6 });
  assert.equal(end.summary.chat, 1);
  assert.match(L.summaryText(end.summary), /mon vote : Absolute Batman/);
  assert.equal(L.saveRoom(L.emptyState(), { title: 'Solo', format: 'free' }, now, 'x').errors.length, 1);
});
