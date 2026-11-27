'use strict';
// D-125 : boîte de réception en ligne — pastilles non lues, fils, vocaux, retranscription, fils de pensées
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('./dm-inbox');

const U1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', U2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const inbox = {
  dms: [
    { id: 'c1', status: 'active', mine: true, with: 'bob', unread: 3, last_id: 30, last_at: '2026-11-22T10:00:00Z' },
    { id: 'c2', status: 'request', mine: false, with: 'inconnu', unread: 1, last_id: 31, last_at: '2026-11-22T11:00:00Z' },
    { id: 'c3', status: 'active', mine: false, with: 'cleo', unread: 0, last_id: 5, last_at: '2026-11-20T09:00:00Z' },
    { id: 'c4', status: 'closed', mine: false, with: 'ferme', unread: 2 }
  ],
  groups: [
    { id: 'g1', name: 'Club Watchmen', status: 'active', role: 'owner', members: 4, unread: 12, last_id: 40, last_at: '2026-11-22T12:00:00Z', muted: false },
    { id: 'g2', name: 'Bourse BD', status: 'active', role: 'member', members: 9, unread: 7, last_id: 41, last_at: '2026-11-21T12:00:00Z', muted: true },
    { id: 'g3', name: 'Invitation', status: 'invited', role: 'member', members: 2, unread: 0, invited_by: 'bob', last_at: '2026-11-19T12:00:00Z' }
  ]
};

test('pastilles : l\'icône compte les personnes et groupes en attente, chaque fil ses messages', () => {
  assert.equal(I.badgeText(0), ''); assert.equal(I.badgeText(1), '1'); assert.equal(I.badgeText(3), '3'); assert.equal(I.badgeText(150), '99+'); assert.equal(I.badgeText(-2), '');
  const list = I.threads(inbox);
  assert.deepEqual(list.map(t => t.id), ['g1', 'c2', 'c1', 'g2', 'c3', 'g3'], 'trié du plus récent au plus ancien, fils fermés exclus');
  const s = I.summary(list);
  assert.equal(s.people, 2, 'bob et le club ; le groupe en sourdine ne compte pas sur l\'icône');
  assert.equal(s.requests, 2, 'une demande de message et une invitation de groupe');
  assert.equal(s.icon, 4);
  assert.equal(s.messages, 22);
  assert.equal(s.muted, 1);
  assert.equal(I.rowBadge(list.find(t => t.id === 'g1')), '12');
  assert.equal(I.rowBadge(list.find(t => t.id === 'g2')), '7', 'en sourdine : le compteur reste dans la liste');
  assert.equal(I.rowBadge(list.find(t => t.id === 'c2')), '', 'une demande n\'a pas de compteur, elle est dans « Demandes »');
  assert.equal(I.rowHint(list.find(t => t.id === 'g3')), 'Invitation de @bob');
  assert.equal(I.rowHint(list.find(t => t.id === 'c1')), '3 nouveaux messages');
  assert.equal(I.rowHint(list.find(t => t.id === 'g2')), '9 membres · en sourdine');
});

test('onglets, recherche et nouveaux messages à signaler', () => {
  const list = I.threads(inbox);
  assert.deepEqual(I.filterThreads(list, 'main').map(t => t.id), ['g1', 'c1', 'g2', 'c3']);
  assert.deepEqual(I.filterThreads(list, 'requests').map(t => t.id), ['c2', 'g3']);
  assert.deepEqual(I.filterThreads(list, 'main', 'WATCH').map(t => t.id), ['g1']);
  const later = I.threads({ ...inbox, groups: inbox.groups.map(g => g.id === 'g2' ? { ...g, last_id: 50, unread: 8 } : g.id === 'g1' ? { ...g, last_id: 45, unread: 13 } : g) });
  assert.deepEqual(I.freshThreads(list, later).map(t => t.id), ['g1'], 'un groupe en sourdine ne déclenche pas d\'alerte');
});

test('vocal : contenu vérifié, illisible montré comme texte', () => {
  const v = { kind: 'voice', path: I.voicePath(U1, U2, 'ab'.repeat(16)), ref: { key: 'a2V5', iv: 'aXY=', digest: 'f'.repeat(64), size: 2048 }, dur: 12.34, mime: 'audio/webm;codecs=opus', peaks: [0, 50, 100], tr: 'bonjour \u0007à tous' };
  const s = I.encodeContent(v);
  assert.ok(s.startsWith(I.PREFIX));
  const back = I.decodeContent(s);
  assert.equal(back.kind, 'voice'); assert.equal(back.dur, 12.3); assert.equal(back.tr, 'bonjour à tous');
  assert.equal(I.preview(s), 'Message vocal · 0:12');
  assert.deepEqual(I.decodeContent('Salut'), { kind: 'text', text: 'Salut' });
  assert.equal(I.encodeContent({ kind: 'text', text: 'Salut' }), 'Salut');
  assert.equal(I.decodeContent(I.PREFIX + '{"kind":"voice","path":"../../etc"}').kind, 'text');
  assert.throws(() => I.encodeContent({ ...v, dur: 600 }), /invalid_voice/);
  assert.throws(() => I.encodeContent({ ...v, peaks: [101] }), /invalid_voice/);
  assert.throws(() => I.encodeContent({ ...v, ref: { ...v.ref, size: I.MAX_VOICE_BYTES + 1 } }), /invalid_voice/);
  assert.throws(() => I.voicePath('pas-un-fil', U2, 'ab'.repeat(16)), /invalid_path/);
});

test('onde, durée et format d\'enregistrement', () => {
  const s = new Float32Array(480).map((_, i) => i < 240 ? 0.1 : -0.5);
  const p = I.peaks(s, 4);
  assert.deepEqual(p, [20, 20, 100, 100]);
  assert.deepEqual(I.peaks([], 3), [0, 0, 0]);
  assert.equal(I.peaks(new Float32Array(1000).fill(0.2)).length, I.BARS);
  assert.equal(I.formatDuration(0), '0:00'); assert.equal(I.formatDuration(65.4), '1:05');
  assert.equal(I.playedBars(5, 10, 48), 24); assert.equal(I.playedBars(20, 10, 48), 48); assert.equal(I.playedBars(1, 0), 0);
  assert.equal(I.pickMime(m => m === 'audio/mp4'), 'audio/mp4');
  assert.equal(I.pickMime(() => { throw new Error('x'); }), '');
});

test('retranscription : Web Speech détectée, texte propre ; absente sur Android', () => {
  assert.equal(I.speechSupport({ webkitSpeechRecognition: function () {} }), 'web');
  assert.equal(I.speechSupport({ SpeechRecognition: function () {} }), 'web');
  assert.equal(I.speechSupport({}), 'none');
  assert.equal(I.speechSupport(null), 'none');
  assert.equal(I.joinTranscript(['  bonjour', 'à tous ', '', 'ce soir']), 'Bonjour à tous ce soir');
  assert.equal(I.joinTranscript([]), '');
  assert.equal(I.joinTranscript(['x'.repeat(3000)]).length, I.MAX_TRANSCRIPT);
});

test('fil de pensées : découpage en parties numérotées, coupe sur une phrase', () => {
  assert.deepEqual(I.splitThread('Court.', 2000), ['Court.']);
  assert.deepEqual(I.splitThread('   ', 2000), []);
  const long = Array.from({ length: 60 }, (_, i) => 'Phrase numéro ' + i + ' sur Batman.').join(' ');
  const parts = I.splitThread(long, 400);
  assert.ok(parts.length > 1);
  parts.forEach((p, i) => { assert.ok(p.length <= 400, 'partie ' + i + ' trop longue'); assert.ok(p.endsWith('(' + (i + 1) + '/' + parts.length + ')')); });
  assert.ok(parts[0].replace(/ \(\d+\/\d+\)$/, '').endsWith('.'), 'coupe après un point');
  assert.equal(parts.map(p => p.replace(/ \(\d+\/\d+\)$/, '')).join(' '), long, 'rien n\'est perdu');
});

test('erreurs du serveur traduites', () => {
  assert.equal(I.reason({ message: 'epoch_stale' }), I.REASON.epoch_stale);
  assert.equal(I.reason(new Error('Failed to fetch')), I.REASON.network);
  assert.equal(I.reason('quelque chose'), I.REASON.unknown);
});

test('fil façon messagerie (D-135) : jours, heure relative, emojis en grand, bulles regroupées', () => {
  const now = new Date(2026, 10, 28, 15, 0);
  assert.equal(I.dayLabel(new Date(2026, 10, 28, 9, 0), now), 'Aujourd’hui');
  assert.equal(I.dayLabel(new Date(2026, 10, 27, 23, 0), now), 'Hier');
  assert.equal(I.dayLabel(new Date(2026, 10, 25, 12, 0), now), 'Mercredi');
  assert.equal(I.dayLabel(new Date(2026, 9, 3, 12, 0), now), '3 oct.');
  assert.equal(I.dayLabel(new Date(2025, 0, 9, 12, 0), now), '9 janv. 2025');
  assert.equal(I.dayLabel('pas une date', now), '');
  assert.equal(I.ago(new Date(2026, 10, 28, 14, 59, 30), now), 'à l’instant');
  assert.equal(I.ago(new Date(2026, 10, 28, 14, 48), now), '12 min');
  assert.equal(I.ago(new Date(2026, 10, 28, 12, 0), now), '3 h');
  assert.equal(I.ago(new Date(2026, 10, 26, 15, 0), now), '2 j');
  assert.equal(I.ago(new Date(2026, 10, 7, 15, 0), now), '3 sem.');
  assert.equal(I.ago(null, now), '');
  assert.equal(I.bigEmoji('🔥'), true);
  assert.equal(I.bigEmoji('🦸‍♂️ 🦸‍♀️'), true);
  assert.equal(I.bigEmoji('👍🏽'), true);
  assert.equal(I.bigEmoji('🇫🇷'), true);
  assert.equal(I.bigEmoji('🔥🔥🔥🔥🔥🔥🔥'), false);
  assert.equal(I.bigEmoji('ok 👍'), false);
  assert.equal(I.bigEmoji('12'), false);
  assert.equal(I.bigEmoji(''), false);
  const at = (h, m) => new Date(2026, 10, 28, h, m).toISOString();
  const msgs = [
    { me: false, from: 'bob', at: new Date(2026, 10, 27, 20, 0).toISOString() },
    { me: false, from: 'bob', at: at(10, 0) }, { me: false, from: 'bob', at: at(10, 2) },
    { me: true, at: at(10, 3) }, { me: true, at: at(10, 20) },
    { me: true, at: at(12, 0) }
  ];
  const L = I.layout(msgs, now);
  assert.deepEqual(L.map(x => x.sep ? 'S:' + x.sep : x.i + (x.first ? 'F' : '') + (x.last ? 'L' : '')), [
    'S:Hier · 20:00', '0FL', 'S:Aujourd’hui · 10:00', '1F', '2L', '3FL', '4FL', 'S:Aujourd’hui · 12:00', '5FL'
  ]);
  assert.deepEqual(I.layout(null, now), []);
  // Sans date lisible : pas d'intertitre, chaque bulle reste seule
  assert.deepEqual(I.layout([{ me: true }, { me: true }], now).map(x => x.first + '/' + x.last), ['true/true', 'true/true']);
});
