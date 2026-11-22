'use strict';
// Messages privés « comme Signal » (D-114) — module pur, sans réseau ni stockage : WebCrypto standard uniquement.
// Protocole, d'après les spécifications publiques de Signal (X3DH et Double Ratchet), adapté aux courbes de WebCrypto :
//  - X3DH : clé d'identité (ECDH P-256), clé de signature (ECDSA P-256), prépublication signée (ECDH) et prépublications
//    à usage unique ; le secret partagé = HKDF(DH1 ‖ DH2 ‖ DH3 [‖ DH4]) ; la signature de la prépublication est vérifiée.
//  - Double cliquet : cliquet Diffie-Hellman à chaque changement de sens + chaînes symétriques HMAC-SHA-256 ;
//    une clé par message, effacée après usage (confidentialité persistante, rétablissement après compromission) ;
//    messages hors d'ordre gardés au plus MAX_SKIP ; un rejeu est refusé (la clé n'existe plus).
//  - Chaque message : AES-GCM 256, en-tête authentifié (données associées = identités + en-tête) ;
//    texte rembourré par blocs de 64 octets pour masquer sa longueur exacte.
// Les clés privées sont créées NON exportables ; l'état se range tel quel dans IndexedDB (clonage structuré).

const subtle = () => { const s = globalThis.crypto && globalThis.crypto.subtle; if (!s) throw new Error('crypto_unavailable'); return s; };
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = u8 => { const u = new Uint8Array(u8); let s = ''; for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]); return btoa(s); };
const unb64 = s => { const bin = atob(String(s || '')); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const cat = (...arrs) => { const n = arrs.reduce((a, x) => a + x.length, 0), out = new Uint8Array(n); let o = 0; for (const x of arrs) { out.set(x, o); o += x.length; } return out; };
const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

const ALG = 'X3DH-P256/DoubleRatchet-HMAC-SHA256/AES-GCM-256';
const MAX_SKIP = 1000;
const PAD = 64;
const INFO = enc.encode('Panel-X3DH-v1');
const F = new Uint8Array(32).fill(0xff); // préfixe de séparation des domaines (spécification X3DH)
const EC = { name: 'ECDH', namedCurve: 'P-256' }, SIG = { name: 'ECDSA', namedCurve: 'P-256' };

const genDH = () => subtle().generateKey(EC, false, ['deriveBits']);
const rawPub = async key => new Uint8Array(await subtle().exportKey('raw', key));
const importDH = raw => subtle().importKey('raw', raw, EC, false, []);
const dh = async (priv, pubRaw) => new Uint8Array(await subtle().deriveBits({ name: 'ECDH', public: await importDH(pubRaw) }, priv, 256));
const hkdf = async (salt, ikm, info, len) => {
  const k = await subtle().importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await subtle().deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, k, len * 8));
};
const hmac = async (key, data) => { const k = await subtle().importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']); return new Uint8Array(await subtle().sign('HMAC', k, data)); };
const kdfRK = async (rk, dhOut) => { const o = await hkdf(rk, dhOut, enc.encode('Panel-Ratchet-RK'), 64); return [o.slice(0, 32), o.slice(32)]; };
const kdfCK = async ck => [await hmac(ck, new Uint8Array([2])), await hmac(ck, new Uint8Array([1]))]; // [chaîne suivante, clé de message]

// Rembourrage ISO/IEC 7816-4 : 0x80 puis des zéros jusqu'au multiple de PAD
const pad = u8 => { const n = Math.ceil((u8.length + 1) / PAD) * PAD, out = new Uint8Array(n); out.set(u8); out[u8.length] = 0x80; return out; };
const unpad = u8 => { let i = u8.length - 1; while (i >= 0 && u8[i] === 0) i--; if (i < 0 || u8[i] !== 0x80) throw new Error('tampered'); return u8.slice(0, i); };

// ---------- Identité et prépublications ----------
const createIdentity = async () => {
  const dhk = await genDH(), sk = await subtle().generateKey(SIG, false, ['sign', 'verify']);
  return { dh: dhk, sign: sk, pub: { ik: b64(await rawPub(dhk.publicKey)), sik: b64(new Uint8Array(await subtle().exportKey('raw', sk.publicKey))) } };
};
// Prépublication signée + n prépublications à usage unique ; seule la partie publique part au serveur
const createPrekeys = async (identity, n, firstId) => {
  const spk = await genDH(), spkRaw = await rawPub(spk.publicKey);
  const sig = new Uint8Array(await subtle().sign({ name: 'ECDSA', hash: 'SHA-256' }, identity.sign.privateKey, spkRaw));
  const one = [];
  for (let i = 0; i < (n || 0); i++) { const k = await genDH(); one.push({ id: (firstId || 1) + i, key: k, pub: b64(await rawPub(k.publicKey)) }); }
  return {
    secret: { spk, opk: one.map(o => ({ id: o.id, key: o.key })) },
    bundle: { ik: identity.pub.ik, sik: identity.pub.sik, spk: b64(spkRaw), spkSig: b64(sig), opk: one.map(o => ({ id: o.id, pub: o.pub })) }
  };
};
const verifyBundle = async bundle => {
  try {
    const sik = await subtle().importKey('raw', unb64(bundle.sik), SIG, false, ['verify']);
    return await subtle().verify({ name: 'ECDSA', hash: 'SHA-256' }, sik, unb64(bundle.spkSig), unb64(bundle.spk));
  } catch (_) { return false; }
};

// ---------- X3DH ----------
// Alice (qui écrit la première) : à partir du paquet public de Bob et d'UNE prépublication à usage unique (si disponible)
const x3dhInitiate = async (identity, bundle, opk) => {
  if (!(await verifyBundle(bundle))) throw new Error('bad_signature');
  const ek = await genDH(), spk = unb64(bundle.spk), ikB = unb64(bundle.ik);
  const parts = [F, await dh(identity.dh.privateKey, spk), await dh(ek.privateKey, ikB), await dh(ek.privateKey, spk)];
  if (opk) parts.push(await dh(ek.privateKey, unb64(opk.pub)));
  const sk = await hkdf(new Uint8Array(32), cat(...parts), INFO, 32);
  const ad = cat(unb64(identity.pub.ik), ikB);
  return { sk, ad, init: { ik: identity.pub.ik, ek: b64(await rawPub(ek.publicKey)), opkId: opk ? opk.id : null } };
};
// Bob : retrouve le même secret à partir du message initial ; la prépublication à usage unique est consommée
const x3dhRespond = async (identity, secret, init) => {
  const ikA = unb64(init.ik), ekA = unb64(init.ek);
  const parts = [F, await dh(secret.spk.privateKey, ikA), await dh(identity.dh.privateKey, ekA), await dh(secret.spk.privateKey, ekA)];
  if (init.opkId !== null && init.opkId !== undefined) {
    const o = secret.opk.find(x => x.id === init.opkId);
    if (!o) throw new Error('prekey_used');
    parts.push(await dh(o.key.privateKey, ekA));
  }
  const sk = await hkdf(new Uint8Array(32), cat(...parts), INFO, 32);
  return { sk, ad: cat(ikA, unb64(identity.pub.ik)), usedOpk: init.opkId };
};

// ---------- Double cliquet ----------
const initSender = async (sk, theirSpkB64, ad) => {
  const s = await genDH(), dhr = unb64(theirSpkB64);
  const [rk, cks] = await kdfRK(sk, await dh(s.privateKey, dhr));
  return { DHs: s, DHsPub: await rawPub(s.publicKey), DHr: dhr, RK: rk, CKs: cks, CKr: null, Ns: 0, Nr: 0, PN: 0, skipped: new Map(), ad };
};
const initReceiver = async (sk, spkPair, ad) => ({ DHs: spkPair, DHsPub: await rawPub(spkPair.publicKey), DHr: null, RK: sk, CKs: null, CKr: null, Ns: 0, Nr: 0, PN: 0, skipped: new Map(), ad });
const clone = st => ({ ...st, skipped: new Map(st.skipped) });
const headerBytes = h => enc.encode(JSON.stringify([h.dh, h.pn, h.n]));
const aesKey = async mk => { const o = await hkdf(new Uint8Array(32), mk, enc.encode('Panel-Ratchet-MK'), 32); return subtle().importKey('raw', o, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']); };

// Chiffre : renvoie [nouvel état, message] ; l'état d'entrée n'est jamais modifié
const encrypt = async (state, text) => {
  const t = String(text || '');
  if (!t.trim()) throw new Error('empty');
  if (t.length > 4000) throw new Error('too_long');
  if (!state.CKs) throw new Error('not_ready');
  const st = clone(state);
  const [ck, mk] = await kdfCK(st.CKs);
  st.CKs = ck;
  const header = { dh: b64(st.DHsPub), pn: st.PN, n: st.Ns };
  st.Ns += 1;
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: cat(st.ad, headerBytes(header)) }, await aesKey(mk), pad(enc.encode(t)));
  return [st, { v: 2, alg: ALG, header, iv: b64(iv), ct: b64(new Uint8Array(ct)) }];
};
const skipKeys = async (st, until) => {
  if (st.CKr === null) return;
  if (until - st.Nr > MAX_SKIP) throw new Error('too_many_skipped');
  while (st.Nr < until) {
    const [ck, mk] = await kdfCK(st.CKr);
    st.CKr = ck; st.skipped.set(b64(st.DHr) + ':' + st.Nr, mk); st.Nr += 1;
  }
  while (st.skipped.size > MAX_SKIP) st.skipped.delete(st.skipped.keys().next().value);
};
const ratchetStep = async (st, theirDh) => {
  st.PN = st.Ns; st.Ns = 0; st.Nr = 0; st.DHr = theirDh;
  [st.RK, st.CKr] = await kdfRK(st.RK, await dh(st.DHs.privateKey, st.DHr));
  st.DHs = await genDH(); st.DHsPub = await rawPub(st.DHs.publicKey);
  [st.RK, st.CKs] = await kdfRK(st.RK, await dh(st.DHs.privateKey, st.DHr));
};
const open = async (st, msg, mk) => {
  try {
    const pt = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(msg.iv), additionalData: cat(st.ad, headerBytes(msg.header)) }, await aesKey(mk), unb64(msg.ct));
    return dec.decode(unpad(new Uint8Array(pt)));
  } catch (_) { throw new Error('tampered'); }
};
// Déchiffre : renvoie [nouvel état, texte] ; en cas d'échec l'état d'entrée reste valable (rien n'est consommé)
const decrypt = async (state, msg) => {
  if (!msg || msg.v !== 2 || msg.alg !== ALG || !msg.header) throw new Error('unsupported');
  const h = msg.header, st = clone(state), id = h.dh + ':' + h.n;
  if (st.skipped.has(id)) { const mk = st.skipped.get(id); const text = await open(st, msg, mk); st.skipped.delete(id); return [st, text]; }
  const theirDh = unb64(h.dh);
  if (!Number.isInteger(h.n) || !Number.isInteger(h.pn) || h.n < 0 || h.pn < 0) throw new Error('tampered');
  if (!st.DHr || !eq(theirDh, st.DHr)) { await skipKeys(st, h.pn); await ratchetStep(st, theirDh); }
  if (h.n < st.Nr) throw new Error('replay');
  await skipKeys(st, h.n);
  const [ck, mk] = await kdfCK(st.CKr);
  const text = await open(st, msg, mk);
  st.CKr = ck; st.Nr += 1;
  return [st, text];
};

// Messages éphémères : durée choisie par la conversation, appliquée des deux côtés
const TIMERS = Object.freeze([0, 300, 3600, 86400, 604800]); // secondes : désactivé, 5 min, 1 h, 1 jour, 1 semaine
const TIMER_LABEL = Object.freeze({ 0: 'Désactivés', 300: '5 minutes', 3600: '1 heure', 86400: '1 jour', 604800: '1 semaine' });
const expired = (sentAtMs, timerSec, nowMs) => timerSec > 0 && nowMs - sentAtMs >= timerSec * 1000;

module.exports = { ALG, MAX_SKIP, TIMERS, TIMER_LABEL, createIdentity, createPrekeys, verifyBundle, x3dhInitiate, x3dhRespond, initSender, initReceiver, encrypt, decrypt, expired, pad, unpad };
