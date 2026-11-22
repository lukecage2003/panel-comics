'use strict';
// Messages privés chiffrés de bout en bout (D-113) — module pur, sans réseau ni stockage.
// Chiffrement : WebCrypto standard. Clé d'identité ECDH P-256 par appareil (clé privée NON exportable, gardée dans IndexedDB
// par l'application) ; clé de conversation = ECDH -> HKDF-SHA-256 (sel = identifiant de conversation) -> AES-GCM 256 ;
// chaque message a un vecteur d'initialisation aléatoire de 96 bits et des données associées (conversation, expéditeur, numéro).
// Le serveur ne voit que le texte chiffré, l'heure et les identifiants. Limite connue et écrite : pas encore de « confidentialité
// persistante » à chaque message (protocole à double cliquet de type Signal : RESEARCH, docs/master/SECURITY_AND_COMPLIANCE.md).
// Politique (appliquée aussi côté serveur, migration 19) :
//  - un mineur n'écrit jamais à un adulte, ni l'inverse ; à l'ouverture, les messages privés sont réservés aux adultes ;
//  - premier message = demande ; rien d'autre ne part tant que la demande n'est pas acceptée (sauf abonnement mutuel) ;
//  - un blocage coupe la conversation ; un signalement transmet à l'équipe SEULEMENT les messages que la personne choisit.

const subtle = () => { const s = globalThis.crypto && globalThis.crypto.subtle; if (!s) throw new Error('crypto_unavailable'); return s; };
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = buf => { const u = new Uint8Array(buf); let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); };
const unb64 = s => { const bin = atob(String(s || '')); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const MAX_TEXT = 2000;
const ALG = 'ECDH-P256/HKDF-SHA256/AES-GCM-256';

// Identité de l'appareil : la clé privée ne peut pas être exportée (extractable: false)
const createIdentity = async () => {
  const kp = await subtle().generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
  const pub = await subtle().exportKey('jwk', kp.publicKey);
  return { privateKey: kp.privateKey, publicJwk: { kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y } };
};
const importPublic = jwk => {
  if (!jwk || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.x || !jwk.y) throw new Error('invalid_key');
  return subtle().importKey('jwk', { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y, ext: true }, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
};
// Empreinte de sécurité : 12 groupes de 5 chiffres, identique des deux côtés (clés triées), à comparer de vive voix
const safetyNumber = async (jwkA, jwkB) => {
  const k = [jwkA, jwkB].map(j => j.crv + ':' + j.x + ':' + j.y).sort().join('|');
  const h = new Uint8Array(await subtle().digest('SHA-256', enc.encode('panel-safety-v1|' + k)));
  const out = [];
  for (let i = 0; i < 12; i++) { const v = ((h[i * 2] << 8) | h[i * 2 + 1]) * 100000 / 65536; out.push(String(Math.floor(v)).padStart(5, '0')); }
  return out.join(' ');
};
const conversationKey = async (privateKey, theirJwk, conversationId) => {
  if (!conversationId) throw new Error('invalid_conversation');
  const bits = await subtle().deriveBits({ name: 'ECDH', public: await importPublic(theirJwk) }, privateKey, 256);
  const hk = await subtle().importKey('raw', bits, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: enc.encode('panel-dm-v1|' + conversationId), info: enc.encode('message-key') }, hk, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
};
const aad = (conversationId, senderId, seq) => enc.encode([conversationId, senderId, seq].join('|'));
const seal = async (key, text, meta) => {
  const t = String(text || '');
  if (!t.trim()) throw new Error('empty');
  if (t.length > MAX_TEXT) throw new Error('too_long');
  const m = meta || {};
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: aad(m.conversationId, m.senderId, m.seq) }, key, enc.encode(t));
  return { v: 1, alg: ALG, iv: b64(iv), ct: b64(ct), seq: m.seq };
};
// Ouvre un message ; toute altération (texte, conversation, expéditeur, numéro) fait échouer l'ouverture
const open = async (key, box, meta) => {
  if (!box || box.v !== 1 || box.alg !== ALG) throw new Error('unsupported');
  const m = meta || {};
  try {
    const pt = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(box.iv), additionalData: aad(m.conversationId, m.senderId, box.seq) }, key, unb64(box.ct));
    return dec.decode(pt);
  } catch (_) { throw new Error('tampered'); }
};

// Qui peut écrire à qui (même règle que le serveur)
const canMessage = (me, them, rel) => {
  const r = rel || {};
  if (!me || !them || me.id === them.id) return { ok: false, reason: 'invalid' };
  if (r.blocked) return { ok: false, reason: 'blocked' };
  if (me.minor || them.minor) return { ok: false, reason: 'minor_protected' };
  if (them.dmPolicy === 'nobody') return { ok: false, reason: 'closed' };
  if (them.dmPolicy === 'verified' && !me.verified) return { ok: false, reason: 'verified_only' };
  return { ok: true, request: !(r.mutual || r.accepted) };
};
const REASON = Object.freeze({
  invalid: 'Conversation impossible.', blocked: 'Un blocage existe entre vous.', minor_protected: 'Les messages privés ne sont pas ouverts aux comptes mineurs.',
  closed: 'Cette personne ne reçoit pas de messages.', verified_only: 'Cette personne ne reçoit des messages que des profils Encré.',
  crypto_unavailable: 'Ce navigateur ne permet pas le chiffrement : messages indisponibles.', tampered: 'Message illisible : il a peut-être été modifié.',
  empty: 'Écrivez un message.', too_long: 'Message trop long (' + MAX_TEXT + ' caractères au plus).'
});
const DM_POLICIES = ['everyone', 'verified', 'nobody'];

module.exports = { ALG, MAX_TEXT, DM_POLICIES, REASON, createIdentity, importPublic, safetyNumber, conversationKey, seal, open, canMessage };
