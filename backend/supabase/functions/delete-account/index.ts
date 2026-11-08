// Lot 3.6 (D-45) — Enveloppe Deno de l'Edge Function « delete-account ». NON DÉPLOYÉE, jamais exécutée contre Supabase.
// Déploiement (par l'utilisateur, après 3.2) : `supabase functions deploy delete-account` ; SUPABASE_SERVICE_ROLE_KEY est fournie
// par la plateforme comme variable d'environnement et ne doit jamais apparaître dans le dépôt ni dans le client.
import { createRequire } from 'node:module';
import { createClient } from 'npm:@supabase/supabase-js@2';

const require = createRequire(import.meta.url);
const { createDeleteAccountHandler } = require('./handler.js');

const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const handle = createDeleteAccountHandler({
  userClientFor: (token: string) => createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }),
  adminClient: createClient(url, service, { auth: { persistSession: false } }),
  log: (msg: string, uid: string) => console.error(msg, uid)
});

Deno.serve(async (req: Request) => {
  const r = await handle({ method: req.method, headers: Object.fromEntries(req.headers), body: await req.text() });
  return new Response(r.status === 204 ? null : r.body, { status: r.status, headers: r.headers });
});
