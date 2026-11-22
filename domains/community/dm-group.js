'use strict';
// Groupes chiffrés de bout en bout (D-125) — module pur, sans réseau ni stockage : WebCrypto standard uniquement.
// Principe des « clés d'expéditeur » (Sender Keys, d'après la conception publique de Signal pour les groupes) :
//  - chaque membre a, pour chaque époque du groupe, sa propre clé de chaîne (32 octets aléatoires) ; chaque message avance la
//    chaîne (HMAC-SHA-256) et reçoit une clé à usage unique ; une clé passée ne permet pas de remonter aux messages d'avant ;
//  - chaque message est signé (ECDSA P-256) avec la clé de signature d'identité de l'expéditeur (celle du paquet X3DH) :
//    un autre membre, qui connaît pourtant la clé de chaîne, ne peut pas se faire passer pour lui ;
//  - la clé de chaîne est confiée à chaque membre scellée pour sa clé d'identité (ECDH avec une clé éphémère, HKDF, AES-GCM)
//    et signée par l'expéditeur ; le serveur ne voit que du chiffré ;
//  - un départ ou un retrait fait changer l'époque (côté serveur) : chacun crée une nouvelle clé et ne la confie qu'aux membres
//    restants. Messages hors d'ordre gardés au plus MAX_SKIP ; un rejeu est refusé (la clé n'existe plus).
// Format des clés publiques : brut non compressé (65 octets) en base64, comme dm-ratchet.

const subtle = () => { const s = globalThis.crypto && globalThis.crypto.subtle; if (!s) throw new Error('crypto_unavailable'); return s; };
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = u8 => { const u = new Uint8Array(u8); let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); };
const unb64 = s => { const bin = atob(String(s || '')); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };

const ALG = 'SenderKey-P256/HMAC-SHA256/AES-GCM-256/ECDSA-P256';
const MAX_SKIP = 1000;
const MAX_MEMBERS = 32;
const MAX_TEXT = 4000;
const PAD = 64;
const EC = { name: 'ECDH', namedCurve: 'P-256' }, SIG = { name: 'ECDSA', namedCurve: 'P-256' }, SHA = { name: 'ECDSA', hash: 'SHA-256' };

const hmac = async (key, data) => { const k = await subtle().importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return new Uint8Array(await subtle().sign('HMAC', k, data)); };
const hkdf = async (ikm, info, len) => {
  const k = await subtle().importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle().deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: enc.encode(info) }, k, len * 8));
};
const step = async ck => [await hmac(ck, new Uint8Array([2])), await hmac(ck, new Uint8Array([1]))]; // [chaîne suivante, clé de message]
const aes = async (raw, use) => subtle().importKey('raw', raw, { name: 'AES-GCM' }, false, use);
const pad = u8 => { const n = Math.ceil((u8.length + 1) / PAD) * PAD, out = new Uint8Array(n); out.set(u8); out[u8.length] = 0x80; return out; };
const unpad = u8 => { let i = u8.length - 1; while (i >= 0 && u8[i] === 0) i--; if (i < 0 || u8[i] !== 0x80) throw new Error('tampered'); return u8.slice(0, i); };
const cat = (a, b) => { const o = new Uint8Array(a.length + b.length); o.set(a); o.set(b, a.length); return o; };
const signed = (groupId, e, n, iv, ct) => enc.encode(JSON.stringify(['panel-group-v1', String(groupId), e, n, iv, ct]));
const importSik = sik => subtle().importKey('raw', unb64(sik), SIG, false, ['verify']);

// Nouvelle clé d'expéditeur pour une époque : { ck, n } — ck reste sur l'appareil et chez les membres, jamais en clair au serveur
const createSenderKey = () => ({ ck: globalThis.crypto.getRandomValues(new Uint8Array(32)), n: 0 });

// Chiffre un message de groupe : renvoie [nouvel état d'envoi, enveloppe] ; l'état d'entrée n'est pas modifié
const encryptGroup = async (state, text, meta) => {
  const t = String(text || ''), m = meta || {};
  if (!t.trim()) throw new Error('empty');
  if (t.length > MAX_TEXT) throw new Error('too_long');
  if (!state || !state.ck || !m.groupId || !m.signKey || !Number.isInteger(m.epoch)) throw new Error('not_ready');
  const [ck, mk] = await step(state.ck);
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12)), n = state.n;
  const ivb = b64(iv), ad = enc.encode(JSON.stringify([String(m.groupId), m.epoch, n]));
  const ct = b64(new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: ad }, await aes(await hkdf(mk, 'Panel-Group-MK', 32), ['encrypt']), pad(enc.encode(t)))));
  const sig = b64(new Uint8Array(await subtle().sign(SHA, m.signKey, signed(m.groupId, m.epoch, n, ivb, ct))));
  return [{ ck, n: n + 1 }, { v: 'g1', alg: ALG, e: m.epoch, n, iv: ivb, ct, sig }];
};

// Déchiffre avec la chaîne reçue d'un expéditeur : renvoie [nouvel état de réception, texte] ; en cas d'échec rien n'est consommé
const decryptGroup = async (state, box, meta) => {
  const m = meta || {};
  if (!box || box.v !== 'g1' || box.alg !== ALG) throw new Error('unsupported');
  if (!state || !state.ck) throw new Error('no_sender_key');
  if (!Number.isInteger(box.n) || box.n < 0 || box.e !== m.epoch) throw new Error('tampered');
  let okSig = false;
  try { okSig = await subtle().verify(SHA, await importSik(m.sik), unb64(box.sig), signed(m.groupId, box.e, box.n, box.iv, box.ct)); } catch (_) { okSig = false; }
  if (!okSig) throw new Error('bad_signature');
  const st = { ck: state.ck, n: state.n, skipped: new Map(state.skipped || []) };
  let mk;
  if (box.n < st.n) {
    mk = st.skipped.get(box.n);
    if (!mk) throw new Error('replay');
    st.skipped.delete(box.n);
  } else {
    if (box.n - st.n > MAX_SKIP) throw new Error('too_many_skipped');
    while (st.n < box.n) { const [ck, k] = await step(st.ck); st.skipped.set(st.n, k); st.ck = ck; st.n += 1; }
    const [ck, k] = await step(st.ck); st.ck = ck; st.n += 1; mk = k;
    while (st.skipped.size > MAX_SKIP) st.skipped.delete(st.skipped.keys().next().value);
  }
  try {
    const ad = enc.encode(JSON.stringify([String(m.groupId), box.e, box.n]));
    const pt = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(box.iv), additionalData: ad }, await aes(await hkdf(mk, 'Panel-Group-MK', 32), ['decrypt']), unb64(box.ct));
    return [st, dec.decode(unpad(new Uint8Array(pt)))];
  } catch (_) { throw new Error('tampered'); }
};

// Confier sa clé de chaîne à un membre : scellée pour sa clé d'identité (ik) et signée par l'expéditeur
const distMeta = (m, eph) => enc.encode(JSON.stringify(['panel-group-dist-v1', String(m.groupId), m.epoch, String(m.from || ''), String(m.to || ''), eph]));
const sealSenderKey = async (identity, recipientIk, sk, meta) => {
  const m = meta || {};
  if (!identity || !identity.sign || !sk || !sk.ck) throw new Error('not_ready');
  const eph = await subtle().generateKey(EC, false, ['deriveBits']), ephPub = b64(new Uint8Array(await subtle().exportKey('raw', eph.publicKey)));
  const their = await subtle().importKey('raw', unb64(recipientIk), EC, false, []);
  const shared = new Uint8Array(await subtle().deriveBits({ name: 'ECDH', public: their }, eph.privateKey, 256));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12)), ivb = b64(iv), ad = distMeta(m, ephPub);
  const ct = b64(new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: ad }, await aes(await hkdf(shared, 'Panel-Group-Dist', 32), ['encrypt']),
    enc.encode(JSON.stringify({ ck: b64(sk.ck), n: sk.n })))));
  const sig = b64(new Uint8Array(await subtle().sign(SHA, identity.sign.privateKey, cat(ad, enc.encode(ivb + '|' + ct)))));
  return { eph: ephPub, iv: ivb, ct, sig };
};
// Ouvrir une clé confiée : signature de l'expéditeur vérifiée, puis déchiffrement avec sa propre clé d'identité
const openSenderKey = async (identity, box, meta) => {
  const m = meta || {};
  if (!box || !box.eph || !box.ct || !box.sig) throw new Error('tampered');
  const ad = distMeta(m, box.eph);
  let ok = false;
  try { ok = await subtle().verify(SHA, await importSik(m.senderSik), unb64(box.sig), cat(ad, enc.encode(box.iv + '|' + box.ct))); } catch (_) { ok = false; }
  if (!ok) throw new Error('bad_signature');
  try {
    const eph = await subtle().importKey('raw', unb64(box.eph), EC, false, []);
    const shared = new Uint8Array(await subtle().deriveBits({ name: 'ECDH', public: eph }, identity.dh.privateKey, 256));
    const pt = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(box.iv), additionalData: ad }, await aes(await hkdf(shared, 'Panel-Group-Dist', 32), ['decrypt']), unb64(box.ct));
    const o = JSON.parse(dec.decode(pt));
    const ck = unb64(o.ck);
    if (ck.length !== 32 || !Number.isInteger(o.n) || o.n < 0) throw new Error('x');
    return { ck, n: o.n, skipped: new Map() };
  } catch (_) { throw new Error('tampered'); }
};

// À qui faut-il (encore) confier sa clé pour l'époque courante ? Membres actifs ou invités, munis d'une clé, sauf soi
const needDistribution = (members, sentTo) => {
  const done = new Set(sentTo || []);
  return (members || []).filter(x => x && !x.me && x.ik && x.sik && (x.status === 'active' || x.status === 'invited') && !done.has(x.handle));
};
const cleanName = name => String(name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 60);
const ROLE_LABEL = Object.freeze({ owner: 'Créateur du groupe', admin: 'Administrateur', member: 'Membre' });
// Ce que chacun peut faire (même règle que le serveur)
const canManage = (myRole, theirRole, action) => {
  if (action === 'invite' || action === 'rename' || action === 'timer') return myRole === 'owner' || myRole === 'admin';
  if (action === 'remove') return myRole === 'owner' ? theirRole !== 'owner' : myRole === 'admin' && theirRole === 'member';
  if (action === 'role') return myRole === 'owner' && theirRole !== 'owner';
  return false;
};

module.exports = { ALG, MAX_SKIP, MAX_MEMBERS, MAX_TEXT, createSenderKey, encryptGroup, decryptGroup, sealSenderKey, openSenderKey, needDistribution, cleanName, ROLE_LABEL, canManage };
