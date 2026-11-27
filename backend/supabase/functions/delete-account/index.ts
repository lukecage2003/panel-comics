// Lot 3.6 (D-45) — Enveloppe Deno de l'Edge Function « delete-account ». Déployée sur la préproduction le 22/11/2026 (D-128).
// SUPABASE_SERVICE_ROLE_KEY est fournie par la plateforme comme variable d'environnement et ne doit jamais apparaître
// dans le dépôt ni dans le client. L'identité est vérifiée par le gestionnaire (jeton de l'utilisateur), d'où verify_jwt désactivé
// (la requête préalable CORS arrive sans jeton).
import { createClient } from 'npm:@supabase/supabase-js@2';

import { createDeleteAccountHandler } from './handler.mjs';

const url = Deno.env.get('SUPABASE_URL')!;
const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const handle = createDeleteAccountHandler({
  userClientFor: (token: string) => createClient(url, anon, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } }),
  adminClient: createClient(url, service, { auth: { persistSession: false } }),
  log: (msg: string, uid: string) => console.error(msg, uid)
});

// Origines admises : la version en ligne, l'application Android (https://localhost) et le serveur local de développement
const ORIGINS = ['https://lukecage2003.github.io', 'https://localhost', 'http://localhost:8093', 'http://127.0.0.1:8093'];
const cors = (origin: string) => ORIGINS.includes(origin)
  ? { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info', 'vary': 'origin' }
  : {};

Deno.serve(async (req: Request) => {
  const c = cors(req.headers.get('origin') || '');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: c });
  const r = await handle({ method: req.method, headers: Object.fromEntries(req.headers), body: await req.text() });
  return new Response(r.status === 204 ? null : r.body, { status: r.status, headers: { ...r.headers, ...c } });
});
