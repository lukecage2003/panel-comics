'use strict';
// Réseau en ligne, lot S8 (D-97) — module pur : prépare les appels aux fonctions api.* de la migration 14 et traduit
// les lignes du serveur en publications du fil. Ni réseau, ni stockage : l'appelant possède le client Supabase.
// Règles :
//  - rien n'est envoyé pour une publication « Moi seul » ;
//  - l'image d'une pensée reste sur l'appareil (stockage des images à venir, D-04) : seul le texte part ;
//  - aucune donnée privée de la collection (prix, valeur, emplacement, notes) n'est jamais placée dans un appel ;
//  - erreurs du serveur traduites en français, sans détail technique.

const NOTE_KINDS = ['thought', 'theory', 'question'];
const FORMATS = ['wednesday', 'review', 'debate', 'qa', 'duel'];
const VERDICTS = ['open', 'confirmed', 'busted'];
const TAG = /#([\p{L}\p{N}_]{2,30})/gu;
const MESSAGES = Object.freeze({
  not_authenticated: 'Connectez-vous pour publier en ligne.',
  not_member: 'Rejoignez d\'abord la communauté (pseudo et tranche d\'âge).',
  not_allowed: 'Votre compte ne peut pas publier pour le moment.',
  rate_limited: 'Doucement : trop d\'envois d\'un coup. Réessayez dans un instant.',
  empty: 'Écrivez quelque chose.',
  too_long: 'Texte trop long.',
  markup_refused: 'Les balises ne sont pas acceptées.',
  invalid_post: 'Publication invalide.',
  private_data_refused: 'Les prix, valeurs et emplacements ne se publient jamais.',
  not_found: 'Contenu introuvable ou plus visible.',
  not_live: 'Ce direct n\'est pas en cours.',
  sides_required: 'Un duel a besoin de deux camps.',
  title_required: 'Donnez un sujet au direct.',
  invalid_side: 'Camp inconnu.',
  invalid_icon: 'Forme de J\'aime inconnue.',
  forbidden: 'Action réservée.',
  blocked: 'Action impossible : un blocage existe entre vous.',
  minor_protected: 'Action impossible pour protéger un compte mineur.',
  network: 'Pas de connexion : votre publication reste sur cet appareil.',
  unknown: 'Action impossible pour le moment. Réessayez plus tard.'
});

const str = (v, n) => String(v === undefined || v === null ? '' : v).slice(0, n);
const tagsOf = text => { const out = []; String(text || '').replace(TAG, (_, t) => { if (!out.some(x => x.toLowerCase() === t.toLowerCase()) && out.length < 10) out.push(t); return ''; }); return out; };

// Pensée locale (notes-core) -> appel api.note_create ; { skip } quand rien ne doit partir
const noteCall = note => {
  if (!note || typeof note !== 'object') return { skip: 'invalid' };
  if (note.visibility === 'private') return { skip: 'private' };
  const body = String(note.text || '').trim();
  if (!body) return { skip: note.imageRef ? 'image_only' : 'empty' };
  const issue = note.issue && note.issue.series ? { series: str(note.issue.series, 120), issue: str(note.issue.issue, 20), publisher: str(note.issue.publisher, 100) } : null;
  return {
    fn: 'note_create',
    args: { p_note_kind: NOTE_KINDS.includes(note.kind) ? note.kind : 'thought', p_body: str(body, 2000), p_tags: tagsOf(body), p_issue: issue,
      p_visibility: note.visibility === 'followers' ? 'followers' : 'public', p_spoiler: note.spoiler === true },
    imageLocalOnly: !!note.imageRef
  };
};
const verdictCall = (postId, verdict) => VERDICTS.includes(verdict) ? { fn: 'note_verdict', args: { p_post: postId, p_verdict: verdict } } : { skip: 'invalid' };
const likeCall = (postId, on) => on ? { fn: 'react', args: { p_post: postId, p_kind: 'like' } } : { fn: 'unreact', args: { p_post: postId } };
const likeIconCall = icon => ({ fn: 'set_like_icon', args: { p_icon: icon } });

// Direct local (live-core) -> api.live_create
const roomCall = (room, visibility) => {
  if (!room || !FORMATS.includes(room.format)) return { skip: 'invalid' };
  const sides = room.duel && Array.isArray(room.duel.sides) ? room.duel.sides : ['', ''];
  return { fn: 'live_create', args: { p_title: str(room.title, 80), p_format: room.format, p_side_a: room.format === 'duel' ? str(sides[0], 40) : '',
    p_side_b: room.format === 'duel' ? str(sides[1], 40) : '', p_visibility: visibility === 'followers' ? 'followers' : 'public', p_starts_at: room.when || null } };
};
const sayCall = (roomId, text) => { const b = String(text || '').trim(); return b ? { fn: 'live_say', args: { p_room: roomId, p_body: str(b, 200) } } : { skip: 'empty' }; };
const voteCall = (roomId, side) => side === 0 || side === 1 ? { fn: 'live_vote', args: { p_room: roomId, p_side: side } } : { skip: 'invalid' };

// Ligne community.posts (+ auteur community.members) -> publication du fil, au format de feed-core
const postFromRow = (row, author, me) => {
  if (!row || row.kind !== 'note' || row.status !== 'visible') return null;
  const pay = row.payload && typeof row.payload === 'object' ? row.payload : {};
  const a = author || {};
  return {
    id: 'o:' + row.id, ref: row.id, type: 'note', online: true, mine: !!me && row.author_id === me,
    kind: NOTE_KINDS.includes(pay.note) ? pay.note : 'thought', at: row.created_at || '', text: str(row.body, 2000), spoiler: !!row.spoiler,
    verdict: pay.note === 'theory' ? (VERDICTS.includes(pay.verdict) ? pay.verdict : 'open') : '', imageRef: '', imageAlt: '',
    visibility: row.visibility === 'followers' ? 'followers' : 'public',
    author: { id: row.author_id, handle: str(a.handle, 24), name: str(a.display_name, 40), likeIcon: str(a.like_icon || 'heart', 32) },
    media: pay.issue && pay.issue.series ? [{ series: str(pay.issue.series, 120), issue: str(pay.issue.issue, 20), publisher: str(pay.issue.publisher, 100), coverUrl: '', variant: '' }] : []
  };
};
const chatFromRow = (row, author, me) => !row || row.status !== 'visible' ? null :
  { id: row.id, text: str(row.body, 200), at: row.created_at || '', mine: !!me && row.author_id === me, handle: str((author || {}).handle, 24) };
const tallyText = (t, sides) => {
  const a = Math.max(0, Number(t && t.a) || 0), b = Math.max(0, Number(t && t.b) || 0), n = a + b;
  if (!n) return 'Aucun vote pour l\'instant';
  const pa = Math.round(a / n * 100);
  return (sides && sides[0] || 'A') + ' ' + pa + ' % · ' + (sides && sides[1] || 'B') + ' ' + (100 - pa) + ' % (' + n + ' vote' + (n > 1 ? 's' : '') + ')';
};
// Erreur Supabase/PostgREST -> message français
const errorText = err => {
  if (!err) return '';
  const m = String(err.message || err.code || err || '');
  if (/fetch|network|Failed to|ECONN/i.test(m)) return MESSAGES.network;
  const k = Object.keys(MESSAGES).find(x => new RegExp('\\b' + x + '\\b').test(m));
  return MESSAGES[k || 'unknown'];
};

module.exports = { NOTE_KINDS, FORMATS, MESSAGES, tagsOf, noteCall, verdictCall, likeCall, likeIconCall, roomCall, sayCall, voteCall, postFromRow, chatFromRow, tallyText, errorText };
