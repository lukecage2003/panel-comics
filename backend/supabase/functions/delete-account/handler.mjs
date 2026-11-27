// Fichier produit à partir de handler.js (même logique, en module ES pour Deno). Ne pas modifier à la main.
// Lot 3.6 (local, D-45) — Logique de l'Edge Function « delete-account », indépendante du runtime (Deno sur Supabase, Node en test).
// JAMAIS déployée ni exécutée contre Supabase. La clé de service n'est lue que par l'enveloppe Deno (variable d'environnement
// du projet), jamais par le client, jamais versionnée.
// Étapes : 1) identité vérifiée par le jeton de l'utilisateur ; 2) phrase de confirmation exacte ; 3) effacement des données
// (api.delete_my_data, mêmes comptes que l'export) ; 4) suppression du compte d'authentification (API d'administration).
// Toute erreur interrompt avant l'étape 4 : un compte n'est jamais supprimé si l'effacement des données a échoué.

const PHRASE = 'SUPPRIMER MON COMPTE';
const DATA_PHRASE = 'SUPPRIMER MES DONNÉES';

function json(status, body) { return { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, body: JSON.stringify(body) }; }

function createDeleteAccountHandler({ userClientFor, adminClient, log = () => {} }) {
  if (typeof userClientFor !== 'function' || !adminClient) throw new Error('userClientFor et adminClient requis');
  return async function handle(req) {
    if (req.method === 'OPTIONS') return json(204, {});
    if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
    const auth = String((req.headers && (req.headers.authorization || req.headers.Authorization)) || '');
    const m = /^Bearer\s+([A-Za-z0-9._-]{20,})$/.exec(auth);
    if (!m) return json(401, { error: 'not_authenticated' });
    let body = {};
    try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}); } catch (_) { return json(400, { error: 'invalid_body' }); }
    if (body.confirm !== PHRASE) return json(400, { error: 'confirmation_required', expected: PHRASE });
    const user = userClientFor(m[1]);
    const who = await user.auth.getUser(m[1]);
    const uid = who && who.data && who.data.user && who.data.user.id;
    if (!uid || (who && who.error)) return json(401, { error: 'not_authenticated' });
    const del = await user.schema('api').rpc('delete_my_data', { p_confirm: DATA_PHRASE });
    if (!del || del.error) { log('delete_my_data a échoué', uid); return json(500, { error: 'data_deletion_failed' }); }
    const acc = await adminClient.auth.admin.deleteUser(uid);
    if (!acc || acc.error) { log('deleteUser a échoué', uid); return json(500, { error: 'account_deletion_failed', data_deleted: true }); }
    return json(200, { status: 'account_deleted', counts: del.data && del.data.counts || {} });
  };
}

export { createDeleteAccountHandler, PHRASE };
