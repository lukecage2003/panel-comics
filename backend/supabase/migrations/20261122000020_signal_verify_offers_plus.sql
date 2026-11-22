-- Migration 20 — Messages façon Signal (préclés, double cliquet, messages éphémères), dossiers de vérification par type de compte,
-- offres, favoris et avis du marché, droit d'accès aux statistiques Panel+ (D-114).
-- PRÉPARÉE ET TESTÉE LOCALEMENT (PGlite) ; non appliquée tant que les comptes en ligne (S8) restent fermés. Additive :
-- aucune table n'est supprimée, aucune donnée n'est effacée ; les fonctions remplacées gardent leur signature.
-- Principes :
--   * messages : le serveur distribue des clés publiques (identité, préclé signée, préclés à usage unique) et stocke du chiffré ;
--     une préclé à usage unique n'est donnée qu'une fois ; un message éphémère n'est plus servi après son échéance et il est purgé ;
--   * vérification : contrôles automatiques (BCE modulo 97, SIREN Luhn, ISBN-13, domaine de l'adresse) ; aucune pièce stockée,
--     seulement l'empreinte SHA-256 et la taille de chaque fichier, effacées 30 jours après la décision ; pastille valable un an ;
--   * marché : une offre vaut au moins 60 % du prix, expire en 48 h, trois en attente au plus ; un avis seulement après une vente terminée ;
--   * Panel+ : le droit est lu dans les abonnements (écrits par le rôle service) ; rien n'est vendu tant que le prix est null.

insert into community.limits (action, max_count, per_seconds) values
  ('dm_bundle', 10, 86400), ('offer', 20, 86400), ('review', 20, 86400), ('favorite', 300, 3600), ('verify', 3, 86400)
on conflict (action) do nothing;

-- ── Messages : paquet de préclés (X3DH) ─────────────────────────────────────────────────────────
-- Clés publiques P-256 au format brut non compressé (65 octets) encodé en base64 (88 caractères)
create function messaging.pub_ok(p text) returns boolean
language sql immutable set search_path = ''
as $$ select coalesce(p ~ '^B[A-P][A-Za-z0-9+/]{85}=$', false); $$;
create table messaging.identities (
  user_id    uuid primary key references community.members (user_id) on delete cascade,
  ik         text not null check (messaging.pub_ok(ik)),
  sik        text not null check (messaging.pub_ok(sik)),
  spk_id     int not null check (spk_id >= 0),
  spk        text not null check (messaging.pub_ok(spk)),
  spk_sig    text not null check (spk_sig ~ '^[A-Za-z0-9+/]{86}==$'),
  updated_at timestamptz not null default now()
);
create table messaging.one_time_prekeys (
  user_id uuid not null references community.members (user_id) on delete cascade,
  key_id  int not null check (key_id >= 0),
  pub     text not null check (messaging.pub_ok(pub)),
  primary key (user_id, key_id)
);
alter table messaging.conversations add column if not exists timer_sec int not null default 0 check (timer_sec in (0, 300, 3600, 86400, 604800));
alter table messaging.messages add column if not exists expires_at timestamptz;
create index if not exists messages_expiry on messaging.messages (expires_at) where expires_at is not null;

-- Enveloppe v2 (double cliquet) : en-tête {dh, pn, n} authentifié, chiffré seul ; init {ik, ek, opkId} sur le premier message
create function messaging.box2_ok(p jsonb) returns boolean
language sql immutable set search_path = ''
as $$ select pg_catalog.jsonb_typeof(p) = 'object'
  and (select pg_catalog.array_agg(k order by k) from pg_catalog.jsonb_object_keys(p) k) <@ array['alg', 'ct', 'header', 'init', 'iv', 'v']
  and p ?& array['alg', 'ct', 'header', 'iv', 'v']
  and p ->> 'v' = '2' and p ->> 'alg' = 'X3DH-P256/DoubleRatchet-HMAC-SHA256/AES-GCM-256'
  and (p ->> 'iv') ~ '^[A-Za-z0-9+/]{16}$' and (p ->> 'ct') ~ '^[A-Za-z0-9+/]+=*$' and char_length(p ->> 'ct') between 24 and 6000
  and pg_catalog.jsonb_typeof(p -> 'header') = 'object' and messaging.pub_ok(p -> 'header' ->> 'dh')
  and (p -> 'header' ->> 'pn') ~ '^\d{1,6}$' and (p -> 'header' ->> 'n') ~ '^\d{1,6}$'
  and (not (p ? 'init') or (messaging.pub_ok(p -> 'init' ->> 'ik') and messaging.pub_ok(p -> 'init' ->> 'ek'))); $$;
-- Les deux enveloppes sont acceptées (v1 pour les conversations existantes, v2 pour les nouvelles)
create or replace function messaging.box_ok(p jsonb) returns boolean
language sql immutable set search_path = ''
as $$ select (pg_catalog.jsonb_typeof(p) = 'object'
  and (select pg_catalog.array_agg(k order by k) from pg_catalog.jsonb_object_keys(p) k) = array['alg', 'ct', 'iv', 'seq', 'v']
  and p ->> 'v' = '1' and p ->> 'alg' = 'ECDH-P256/HKDF-SHA256/AES-GCM-256'
  and (p ->> 'iv') ~ '^[A-Za-z0-9+/]{16}$' and (p ->> 'ct') ~ '^[A-Za-z0-9+/]+=*$' and char_length(p ->> 'ct') between 24 and 4000)
  or messaging.box2_ok(p); $$;

do $$ declare t text; begin
  foreach t in array array['messaging.identities', 'messaging.one_time_prekeys'] loop
    execute format('alter table %s enable row level security', t);
    execute format('revoke all on %s from public, anon, authenticated', t);
  end loop;
end $$;

-- Publier son paquet : clé d'identité, préclé signée (renouvelée régulièrement), jusqu'à 100 préclés à usage unique
create function api.dm_bundle_publish(p_ik text, p_sik text, p_spk_id int, p_spk text, p_spk_sig text, p_opk jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := pro.require_adult(); n int;
begin
  if pg_catalog.jsonb_typeof(coalesce(p_opk, '[]'::jsonb)) <> 'array' or pg_catalog.jsonb_array_length(coalesce(p_opk, '[]'::jsonb)) > 100 then raise exception 'invalid_bundle' using errcode = '22023'; end if;
  perform community.rate_check('dm_bundle');
  insert into messaging.identities (user_id, ik, sik, spk_id, spk, spk_sig) values (me, p_ik, p_sik, p_spk_id, p_spk, p_spk_sig)
    on conflict (user_id) do update set ik = excluded.ik, sik = excluded.sik, spk_id = excluded.spk_id, spk = excluded.spk, spk_sig = excluded.spk_sig, updated_at = now();
  insert into messaging.one_time_prekeys (user_id, key_id, pub)
    select me, (o ->> 'id')::int, o ->> 'pub' from pg_catalog.jsonb_array_elements(coalesce(p_opk, '[]'::jsonb)) o
    on conflict (user_id, key_id) do nothing;
  select count(*) into n from messaging.one_time_prekeys where user_id = me;
  return pg_catalog.jsonb_build_object('status', 'published', 'prekeys', n);
end $$;

-- Obtenir le paquet de quelqu'un pour ouvrir une session : une préclé à usage unique est retirée et donnée une seule fois
create function api.dm_bundle_get(p_handle text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); them uuid; why text; i messaging.identities; o messaging.one_time_prekeys;
begin
  select user_id into them from community.members where handle = pg_catalog.btrim(coalesce(p_handle, ''))::extensions.citext;
  why := messaging.can(me, them);
  if why <> '' then raise exception '%', why using errcode = '42501'; end if;
  select * into i from messaging.identities where user_id = them;
  if not found then raise exception 'no_key' using errcode = '22023'; end if;
  delete from messaging.one_time_prekeys where ctid = (select ctid from messaging.one_time_prekeys where user_id = them order by key_id limit 1 for update skip locked) returning * into o;
  return pg_catalog.jsonb_build_object('ik', i.ik, 'sik', i.sik, 'spkId', i.spk_id, 'spk', i.spk, 'spkSig', i.spk_sig,
    'opk', case when o.user_id is null then null else pg_catalog.jsonb_build_object('id', o.key_id, 'pub', o.pub) end);
end $$;

-- Ouvrir une conversation : une clé v1 OU un paquet v2 suffit ; le paquet v2 est signalé pour que l'application le préfère
create or replace function api.dm_open(p_handle text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); them uuid; why text; c messaging.conversations; mutual boolean; k jsonb; v2 boolean;
begin
  select user_id into them from community.members where handle = pg_catalog.btrim(coalesce(p_handle, ''))::extensions.citext;
  why := messaging.can(me, them);
  if why <> '' then raise exception '%', why using errcode = '42501'; end if;
  select public_jwk into k from messaging.keys where user_id = them;
  v2 := exists (select 1 from messaging.identities i where i.user_id = them);
  if k is null and not v2 then raise exception 'no_key' using errcode = '22023'; end if;
  select * into c from messaging.conversations where a = least(me, them) and b = greatest(me, them);
  if not found then
    perform community.rate_check('dm_open');
    mutual := exists (select 1 from community.follows f where f.follower_id = me and f.followee_id = them) and exists (select 1 from community.follows f where f.follower_id = them and f.followee_id = me);
    insert into messaging.conversations (a, b, requested_by, status) values (least(me, them), greatest(me, them), me, case when mutual then 'active' else 'request' end) returning * into c;
  end if;
  return pg_catalog.jsonb_build_object('id', c.id, 'status', c.status, 'their_key', k, 'v2', v2, 'timer', c.timer_sec);
end $$;

-- Combien de préclés me reste-t-il ? (l'application en republie sous 20)
create function api.dm_prekeys_left() returns int
language sql security definer set search_path = '' stable
as $$ select count(*)::int from messaging.one_time_prekeys where user_id = auth.uid(); $$;

-- Messages éphémères : réglés par conversation, visibles des deux côtés
create function api.dm_timer_set(p_conversation uuid, p_seconds int) returns jsonb
language plpgsql security definer set search_path = ''
as $$ begin
  if p_seconds not in (0, 300, 3600, 86400, 604800) then raise exception 'invalid_timer' using errcode = '22023'; end if;
  update messaging.conversations set timer_sec = p_seconds where id = p_conversation and auth.uid() in (a, b) and status in ('request', 'active');
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  return pg_catalog.jsonb_build_object('timer', p_seconds);
end $$;

-- Envoi v2 : numéro d'ordre attribué par le serveur, échéance posée selon le minuteur de la conversation
create function api.dm_send2(p_conversation uuid, p_box jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); c messaging.conversations; other uuid; why text; nid bigint; nseq int;
begin
  if not messaging.box2_ok(p_box) then raise exception 'invalid_box' using errcode = '22023'; end if;
  select * into c from messaging.conversations where id = p_conversation and me in (a, b) for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  other := case when c.a = me then c.b else c.a end;
  why := messaging.can(me, other);
  if why <> '' then raise exception '%', why using errcode = '42501'; end if;
  if c.status in ('declined', 'closed') then raise exception 'closed' using errcode = '42501'; end if;
  if c.status = 'request' and (c.requested_by <> me or exists (select 1 from messaging.messages m where m.conversation_id = c.id)) then raise exception 'request_pending' using errcode = '42501'; end if;
  perform community.rate_check('dm_send');
  select coalesce(max(seq), 0) + 1 into nseq from messaging.messages where conversation_id = c.id and sender_id = me;
  insert into messaging.messages (conversation_id, sender_id, seq, box, expires_at)
    values (c.id, me, nseq, p_box, case when c.timer_sec > 0 then now() + pg_catalog.make_interval(secs => c.timer_sec) end) returning messages.id into nid;
  return pg_catalog.jsonb_build_object('id', nid, 'seq', nseq, 'timer', c.timer_sec);
end $$;

-- Lecture : jamais un message échu
create or replace function api.dm_messages(p_conversation uuid, p_after bigint default 0) returns jsonb
language sql security definer set search_path = '' stable
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', m.id, 'sender', case when m.sender_id = auth.uid() then 'me' else 'them' end, 'box', m.box, 'at', m.created_at,
    'expires', m.expires_at) order by m.id), '[]'::jsonb)
  from messaging.messages m join messaging.conversations c on c.id = m.conversation_id
  where c.id = p_conversation and auth.uid() in (c.a, c.b) and m.id > coalesce(p_after, 0) and (m.expires_at is null or m.expires_at > now());
$$;

-- Purge des messages échus (tâche planifiée, rôle service)
create function messaging.purge_expired() returns int
language plpgsql security definer set search_path = ''
as $$ declare n int; begin
  if auth.uid() is not null then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from messaging.messages where expires_at is not null and expires_at <= now();
  get diagnostics n = row_count; return n;
end $$;
revoke all on function messaging.purge_expired() from public, anon, authenticated;

-- ── Vérification par type de compte ─────────────────────────────────────────────────────────────
create function pro.bce_ok(v text) returns boolean
language sql immutable set search_path = ''
as $$ select d ~ '^[01]\d{9}$' and 97 - (substr(d, 1, 8)::bigint % 97) = substr(d, 9, 2)::int
  from (select pg_catalog.regexp_replace(coalesce(v, ''), '\D', '', 'g') d) x; $$;
create function pro.siren_ok(v text) returns boolean
language sql immutable set search_path = ''
as $$ select d ~ '^\d{9}$' and (select sum(case when i % 2 = 1 then (case when substr(d, 9 - i, 1)::int * 2 > 9 then substr(d, 9 - i, 1)::int * 2 - 9 else substr(d, 9 - i, 1)::int * 2 end)
    else substr(d, 9 - i, 1)::int end) from pg_catalog.generate_series(0, 8) i) % 10 = 0
  from (select pg_catalog.regexp_replace(coalesce(v, ''), '\s', '', 'g') d) x; $$;
create function pro.isbn_ok(v text) returns boolean
language sql immutable set search_path = ''
as $$ select d ~ '^97[89]\d{10}$' and (select sum(substr(d, i + 1, 1)::int * case when i % 2 = 1 then 3 else 1 end) from pg_catalog.generate_series(0, 12) i) % 10 = 0
  from (select pg_catalog.regexp_replace(coalesce(v, ''), '[-\s]', '', 'g') d) x; $$;
create function pro.domain_ok(p_email text, p_site text) returns boolean
language sql immutable set search_path = ''
as $$ select coalesce(h <> '' and (e = h or e like '%.' || h), false)
  from (select lower(substring(coalesce(p_email, '') from '@([A-Za-z0-9.-]+)$')) e,
    pg_catalog.regexp_replace(lower(substring(coalesce(p_site, '') from '^https://([A-Za-z0-9.-]+)')), '^www\.', '') h) x; $$;

-- Dossier : ce qui est contrôlé automatiquement, les empreintes des pièces (jamais les pièces), l'étape de l'examen
alter table pro.applications add column if not exists country text not null default '' check (country = '' or country ~ '^[A-Z]{2}$');
alter table pro.applications add column if not exists company_no text not null default '' check (char_length(company_no) <= 20);
alter table pro.applications add column if not exists company_ok boolean;
alter table pro.applications add column if not exists website text not null default '' check (website = '' or website ~* '^https://[^\s<>"]+$');
alter table pro.applications add column if not exists domain_ok boolean;
alter table pro.applications add column if not exists isbn_ok boolean;
alter table pro.applications add column if not exists proof_code text not null default '';
alter table pro.applications add column if not exists attest jsonb not null default '[]'::jsonb check (pg_catalog.jsonb_typeof(attest) = 'array' and pg_catalog.jsonb_array_length(attest) <= 8);
alter table pro.applications add column if not exists stage text not null default 'submitted' check (stage in ('submitted', 'in_review', 'needs_more'));
alter table pro.applications add column if not exists refusal text check (refusal is null or refusal in ('unreadable', 'mismatch', 'no_publication', 'not_comics', 'impersonation', 'expired_doc'));
alter table pro.applications add column if not exists purge_after timestamptz;

-- Empreinte d'une pièce : {key, sha256 (64 hex), bytes (1 o à 10 Mo), ext}
create function pro.attest_ok(p jsonb) returns boolean
language sql immutable set search_path = ''
as $$ select not exists (select 1 from pg_catalog.jsonb_array_elements(coalesce(p, '[]'::jsonb)) a
  where pg_catalog.jsonb_typeof(a) <> 'object' or (a ->> 'key') !~ '^[a-z_]{2,20}$' or (a ->> 'sha256') !~ '^[0-9a-f]{64}$'
    or (a ->> 'bytes') !~ '^\d{1,9}$' or (a ->> 'bytes')::bigint not between 1 and 10485760 or coalesce(a ->> 'ext', '') not in ('pdf', 'jpg', 'png')); $$;

-- Pièces obligatoires par type (mêmes clés que le module verify-core)
create function pro.required_docs(p_kind text) returns text[]
language sql immutable set search_path = ''
as $$ select case p_kind when 'creator' then array['identity', 'credits', 'proof_link'] when 'shop' then array['company', 'address', 'storefront', 'identity']
  when 'publisher' then array['company', 'domain_email', 'mandate', 'identity', 'catalogue'] when 'studio' then array['company', 'members', 'credits'] else array[]::text[] end; $$;

-- Pastille : valable un an après la décision, puis à renouveler (aucun changement d'état nécessaire)
create or replace function pro.seal_of(p_user uuid) returns text
language sql security definer set search_path = '' stable
as $$ select p.kind from pro.profiles p where p.user_id = p_user and p.status = 'verified' and (p.verified_at is null or p.verified_at > now() - interval '365 days'); $$;
revoke all on function pro.seal_of(uuid) from public, anon, authenticated;
-- Fiche pro : la pastille suit la même règle (expirée = absente)
create or replace function api.pro_get(p_handle text) returns jsonb
language sql security definer set search_path = '' stable
as $$
  select pg_catalog.jsonb_build_object('handle', m.handle::text, 'kind', p.kind, 'name', p.name, 'roles', p.roles, 'bio', p.bio, 'links', p.links, 'works', p.works,
    'open', p.open_collab, 'city', p.city, 'seal', pro.seal_of(p.user_id), 'renew_at', case when p.status = 'verified' then p.verified_at + interval '365 days' end)
  from community.members m join pro.profiles p on p.user_id = m.user_id
  where m.handle = pg_catalog.btrim(coalesce(p_handle, ''))::extensions.citext and forum.sees(auth.uid(), m.user_id);
$$;

create function api.verify_submit(p_ticked text[], p_country text, p_company_no text, p_website text, p_domain_email text, p_isbn text, p_attest jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := pro.require_adult(); p pro.profiles; need text[]; c_ok boolean; d_ok boolean; i_ok boolean; code text; open_app pro.applications; reopen boolean;
begin
  select * into p from pro.profiles where user_id = me;
  if not found then raise exception 'profile_required' using errcode = '22023'; end if;
  if p.status = 'verified' and p.verified_at > now() - interval '335 days' then raise exception 'already_verified' using errcode = '22023'; end if;
  need := pro.required_docs(p.kind);
  if not (need <@ coalesce(p_ticked, '{}')) then raise exception 'evidence_missing' using errcode = '22023'; end if;
  if not pro.attest_ok(p_attest) then raise exception 'invalid_attest' using errcode = '22023'; end if;
  if coalesce(p_website, '') <> '' and p_website !~* '^https://[^\s<>"]+$' then raise exception 'invalid_link' using errcode = '22023'; end if;
  c_ok := case when coalesce(p_company_no, '') = '' then null when p_country = 'BE' then pro.bce_ok(p_company_no) when p_country = 'FR' then pro.siren_ok(p_company_no) else null end;
  if c_ok is false then raise exception 'company_number_invalid' using errcode = '22023'; end if;
  d_ok := case when coalesce(p_domain_email, '') = '' then null else pro.domain_ok(p_domain_email, p_website) end;
  if p.kind = 'publisher' and d_ok is not true then raise exception 'domain_mismatch' using errcode = '22023'; end if;
  i_ok := case when coalesce(p_isbn, '') = '' then null else pro.isbn_ok(p_isbn) end;
  if i_ok is false then raise exception 'isbn_invalid' using errcode = '22023'; end if;
  select * into open_app from pro.applications where user_id = me and status = 'open' for update;
  reopen := found;
  if reopen and open_app.stage <> 'needs_more' then raise exception 'already_open' using errcode = '22023'; end if;
  perform community.rate_check('verify');
  code := 'PANEL-' || upper(substr(encode(pg_catalog.sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), 1, 4)) || '-' || upper(substr(encode(pg_catalog.sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), 1, 4));
  if reopen then
    update pro.applications set ticked = need, country = coalesce(p_country, ''), company_no = coalesce(p_company_no, ''), company_ok = c_ok, website = coalesce(p_website, ''),
      domain_ok = d_ok, isbn_ok = i_ok, attest = coalesce(p_attest, '[]'::jsonb), stage = 'submitted' where id = open_app.id;
    code := open_app.proof_code;
  else
    insert into pro.applications (user_id, kind, ticked, country, company_no, company_ok, website, domain_ok, isbn_ok, proof_code, attest)
      values (me, p.kind, need, coalesce(p_country, ''), coalesce(p_company_no, ''), c_ok, coalesce(p_website, ''), d_ok, i_ok, code, coalesce(p_attest, '[]'::jsonb));
  end if;
  update pro.profiles set status = 'pending', updated_at = now() where user_id = me;
  return pg_catalog.jsonb_build_object('status', 'submitted', 'proof_code', code, 'company_ok', c_ok, 'domain_ok', d_ok, 'isbn_ok', i_ok);
end $$;

-- Examen par l'équipe (double authentification) : prendre en charge, demander une pièce, accepter, refuser avec un motif
create function api.verify_review(p_user uuid, p_action text, p_refusal text default null, p_note text default '') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare a pro.applications; nxt text;
begin
  if not community.is_staff() or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'own_review' using errcode = '42501'; end if;
  select * into a from pro.applications where user_id = p_user and status = 'open' for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_action = 'take' and a.stage = 'submitted' then update pro.applications set stage = 'in_review' where id = a.id; return pg_catalog.jsonb_build_object('stage', 'in_review'); end if;
  if a.stage <> 'in_review' then raise exception 'invalid_transition' using errcode = '22023'; end if;
  if p_action = 'ask' then
    if char_length(coalesce(p_note, '')) < 3 then raise exception 'reason_required' using errcode = '22023'; end if;
    update pro.applications set stage = 'needs_more', decision = left(p_note, 500) where id = a.id;
    return pg_catalog.jsonb_build_object('stage', 'needs_more');
  elsif p_action = 'approve' then nxt := 'verified';
  elsif p_action = 'refuse' then
    if p_refusal is null then raise exception 'reason_required' using errcode = '22023'; end if;
    nxt := 'refused';
  else raise exception 'invalid_transition' using errcode = '22023'; end if;
  update pro.applications set status = case when nxt = 'verified' then 'accepted' else 'refused' end, refusal = case when nxt = 'refused' then p_refusal end,
    decided_by = auth.uid(), decision = left(coalesce(nullif(p_note, ''), coalesce(p_refusal, 'Vérifié')), 500), decided_at = now(), purge_after = now() + interval '30 days' where id = a.id;
  update pro.profiles set status = nxt, verified_at = case when nxt = 'verified' then now() end, verified_by = case when nxt = 'verified' then auth.uid() end, updated_at = now() where user_id = p_user;
  return pg_catalog.jsonb_build_object('status', nxt);
end $$;

-- Où en est mon dossier ? (jamais les empreintes : seulement l'étape, les contrôles et le motif)
create function api.verify_status() returns jsonb
language sql security definer set search_path = '' stable
as $$
  select pg_catalog.jsonb_build_object('kind', p.kind, 'status', p.status, 'seal', pro.seal_of(p.user_id), 'verified_at', p.verified_at,
    'renew_at', case when p.verified_at is not null then p.verified_at + interval '365 days' end,
    'application', (select pg_catalog.jsonb_build_object('stage', a.stage, 'status', a.status, 'proof_code', a.proof_code, 'company_ok', a.company_ok, 'domain_ok', a.domain_ok,
      'isbn_ok', a.isbn_ok, 'refusal', a.refusal, 'note', a.decision, 'at', a.created_at) from pro.applications a where a.user_id = p.user_id order by a.created_at desc limit 1))
  from pro.profiles p where p.user_id = auth.uid();
$$;

-- File d'examen de l'équipe (double authentification)
create function api.verify_queue() returns jsonb
language plpgsql security definer set search_path = '' stable
as $$ begin
  if not community.is_staff() or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then raise exception 'forbidden' using errcode = '42501'; end if;
  return (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('user', a.user_id, 'handle', m.handle::text, 'kind', a.kind, 'name', p.name, 'stage', a.stage,
    'country', a.country, 'company_ok', a.company_ok, 'domain_ok', a.domain_ok, 'isbn_ok', a.isbn_ok, 'proof_code', a.proof_code, 'website', a.website,
    'attest', a.attest, 'at', a.created_at) order by a.created_at), '[]'::jsonb)
    from pro.applications a join pro.profiles p on p.user_id = a.user_id join community.members m on m.user_id = a.user_id where a.status = 'open');
end $$;

-- Effacement des empreintes 30 jours après la décision (tâche planifiée, rôle service)
create function pro.verify_purge() returns int
language plpgsql security definer set search_path = ''
as $$ declare n int; begin
  if auth.uid() is not null then raise exception 'forbidden' using errcode = '42501'; end if;
  update pro.applications set attest = '[]'::jsonb, company_no = '' where purge_after is not null and purge_after <= now() and (attest <> '[]'::jsonb or company_no <> '');
  get diagnostics n = row_count; return n;
end $$;
revoke all on function pro.verify_purge(), pro.bce_ok(text), pro.siren_ok(text), pro.isbn_ok(text), pro.domain_ok(text, text), pro.attest_ok(jsonb), pro.required_docs(text) from public, anon, authenticated;

-- ── Marché : offres, favoris, avis ──────────────────────────────────────────────────────────────
create table market.offers (
  id           uuid primary key default gen_random_uuid(),
  listing_id   uuid not null references market.listings (id) on delete cascade,
  buyer_id     uuid not null references community.members (user_id) on delete cascade,
  amount_cents int not null check (amount_cents > 0),
  delivery     text not null check (delivery in ('relay', 'parcel', 'hand')),
  status       text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'withdrawn', 'expired')),
  expires_at   timestamptz not null default now() + interval '48 hours',
  created_at   timestamptz not null default now()
);
create index offers_listing on market.offers (listing_id, status);
create table market.favorites (
  user_id    uuid not null references community.members (user_id) on delete cascade,
  listing_id uuid not null references market.listings (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);
create table market.reviews (
  order_id    uuid primary key references market.orders (id) on delete cascade,
  reviewer_id uuid references community.members (user_id) on delete set null,
  seller_id   uuid references community.members (user_id) on delete set null,
  stars       smallint not null check (stars between 1 and 5),
  body        text not null default '' check (char_length(body) <= 500),
  created_at  timestamptz not null default now()
);
create index reviews_seller on market.reviews (seller_id);
do $$ declare t text; begin
  foreach t in array array['market.offers', 'market.favorites', 'market.reviews'] loop
    execute format('alter table %s enable row level security', t);
    execute format('revoke all on %s from public, anon, authenticated', t);
  end loop;
end $$;

create function api.offer_make(p_listing uuid, p_amount_cents int, p_delivery text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := pro.require_adult(); l market.listings; pending int; nid uuid;
begin
  select * into l from market.listings where id = p_listing and status = 'listed';
  if not found or not forum.sees(me, l.seller_id) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if l.seller_id = me then raise exception 'own_listing' using errcode = '22023'; end if;
  if not (p_delivery = any (l.delivery)) then raise exception 'invalid_delivery' using errcode = '22023'; end if;
  if p_amount_cents >= l.price_cents then raise exception 'buy_instead' using errcode = '22023'; end if;
  if p_amount_cents < ceil(l.price_cents * 0.6) then raise exception 'offer_too_low' using errcode = '22023'; end if;
  select count(*) into pending from market.offers where listing_id = l.id and buyer_id = me and status = 'pending' and expires_at > now();
  if pending >= 3 then raise exception 'too_many_offers' using errcode = '22023'; end if;
  perform community.rate_check('offer');
  insert into market.offers (listing_id, buyer_id, amount_cents, delivery) values (l.id, me, p_amount_cents, p_delivery) returning offers.id into nid;
  return pg_catalog.jsonb_build_object('offer', nid, 'expires_in_hours', 48);
end $$;

-- Le vendeur accepte (une réservation est créée au prix de l'offre, frais au taux du jour) ou refuse ; l'acheteur peut retirer
create function api.offer_respond(p_offer uuid, p_action text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); o market.offers; l market.listings; rate numeric; nid uuid;
begin
  select * into o from market.offers where id = p_offer for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  select * into l from market.listings where id = o.listing_id for update;
  if o.status <> 'pending' then raise exception 'invalid_transition' using errcode = '22023'; end if;
  if o.expires_at <= now() then update market.offers set status = 'expired' where id = o.id; raise exception 'offer_expired' using errcode = '22023'; end if;
  if p_action = 'withdraw' and me = o.buyer_id then update market.offers set status = 'withdrawn' where id = o.id; return pg_catalog.jsonb_build_object('status', 'withdrawn'); end if;
  if me is distinct from l.seller_id then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_action = 'decline' then update market.offers set status = 'declined' where id = o.id; return pg_catalog.jsonb_build_object('status', 'declined'); end if;
  if p_action <> 'accept' then raise exception 'invalid_transition' using errcode = '22023'; end if;
  select fee_rate into rate from market.settings;
  if rate is null then raise exception 'market_closed' using errcode = '42501'; end if;
  if l.status <> 'listed' then raise exception 'not_available' using errcode = '22023'; end if;
  insert into market.orders (listing_id, buyer_id, seller_id, delivery, price_cents, fee_cents)
    values (l.id, o.buyer_id, l.seller_id, o.delivery, o.amount_cents, pg_catalog.round(o.amount_cents * rate)::int) returning orders.id into nid;
  update market.listings set status = 'reserved' where id = l.id;
  update market.offers set status = 'accepted' where id = o.id;
  update market.offers set status = 'declined' where listing_id = l.id and id <> o.id and status = 'pending';
  insert into market.order_events (order_id, actor_id, action, from_state, to_state) values (nid, me, 'offer_accept', 'listed', 'reserved');
  return pg_catalog.jsonb_build_object('status', 'accepted', 'order', nid);
end $$;

-- Offres reçues (vendeur) et envoyées (acheteur), encore valables
create function api.offers_mine() returns jsonb
language sql security definer set search_path = '' stable
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', o.id, 'listing', l.id, 'title', l.title, 'issue', l.issue, 'price_cents', l.price_cents,
    'amount_cents', o.amount_cents, 'currency', l.currency, 'delivery', o.delivery, 'status', o.status, 'expires', o.expires_at,
    'role', case when o.buyer_id = auth.uid() then 'buyer' else 'seller' end) order by o.created_at desc), '[]'::jsonb)
  from market.offers o join market.listings l on l.id = o.listing_id
  where (o.buyer_id = auth.uid() or l.seller_id = auth.uid()) and (o.status <> 'pending' or o.expires_at > now()) and o.created_at > now() - interval '30 days';
$$;

create function api.favorite_toggle(p_listing uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := pro.require_adult();
begin
  if not exists (select 1 from market.listings l where l.id = p_listing and l.status in ('listed', 'reserved') and forum.sees(me, l.seller_id)) then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform community.rate_check('favorite');
  delete from market.favorites where user_id = me and listing_id = p_listing;
  if found then return pg_catalog.jsonb_build_object('favorite', false); end if;
  insert into market.favorites (user_id, listing_id) values (me, p_listing);
  return pg_catalog.jsonb_build_object('favorite', true);
end $$;

create function api.favorites_mine() returns jsonb
language sql security definer set search_path = '' stable
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', l.id, 'title', l.title, 'issue', l.issue, 'price_cents', l.price_cents, 'currency', l.currency,
    'status', l.status) order by f.created_at desc), '[]'::jsonb)
  from market.favorites f join market.listings l on l.id = f.listing_id
  where f.user_id = auth.uid() and l.status in ('listed', 'reserved') and forum.sees(auth.uid(), l.seller_id);
$$;

-- Avis : l'acheteur d'une vente terminée, une seule fois
create function api.review_leave(p_order uuid, p_stars int, p_body text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := pro.require_adult(); o market.orders;
begin
  select * into o from market.orders where id = p_order and buyer_id = me and state = 'completed';
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if coalesce(p_body, '') ~* '[\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d .-]{7,}\d' then raise exception 'contact_refused' using errcode = '22023'; end if;
  perform community.rate_check('review');
  insert into market.reviews (order_id, reviewer_id, seller_id, stars, body) values (o.id, me, o.seller_id, p_stars, pg_catalog.btrim(coalesce(p_body, '')))
    on conflict (order_id) do nothing;
  if not found then raise exception 'already_reviewed' using errcode = '22023'; end if;
  return pg_catalog.jsonb_build_object('status', 'saved');
end $$;

-- Réputation : moyenne bayésienne (a priori 4 sur 5, poids 5), comme le module market-core
create function api.seller_reputation(p_handle text) returns jsonb
language sql security definer set search_path = '' stable
as $$
  select pg_catalog.jsonb_build_object('n', count(r.*), 'mean', round(avg(r.stars)::numeric, 1),
    'score', round(((4 * 5 + coalesce(sum(r.stars), 0)) / (5 + count(r.*))::numeric), 2),
    'sales', (select count(*) from market.orders o where o.seller_id = m.user_id and o.state = 'completed'))
  from community.members m left join market.reviews r on r.seller_id = m.user_id
  where m.handle = pg_catalog.btrim(coalesce(p_handle, ''))::extensions.citext and community.is_adult(auth.uid()) and forum.sees(auth.uid(), m.user_id)
  group by m.user_id;
$$;

-- ── Panel+ : droits ─────────────────────────────────────────────────────────────────────────────
create function billing.has_plan(p_user uuid, p_plan text) returns boolean
language sql security definer set search_path = '' stable
as $$ select exists (select 1 from billing.subscriptions s where s.user_id = p_user and s.plan = p_plan and s.status = 'active' and s.period_end > now()); $$;
revoke all on function billing.has_plan(uuid, text) from public, anon, authenticated;
create function api.my_entitlements() returns jsonb
language sql security definer set search_path = '' stable
as $$ select pg_catalog.jsonb_build_object('stats_plus', billing.has_plan(auth.uid(), 'plus'), 'plus', billing.has_plan(auth.uid(), 'plus'),
  'seal', pro.seal_of(auth.uid()), 'pro_tools', pro.seal_of(auth.uid()) is not null and (billing.has_plan(auth.uid(), 'creator') or billing.has_plan(auth.uid(), 'publisher') or billing.has_plan(auth.uid(), 'shop'))); $$;

revoke all on function api.dm_bundle_publish(text, text, int, text, text, jsonb), api.dm_bundle_get(text), api.dm_prekeys_left(), api.dm_timer_set(uuid, int), api.dm_send2(uuid, jsonb),
  api.verify_submit(text[], text, text, text, text, text, jsonb), api.verify_review(uuid, text, text, text), api.verify_status(), api.verify_queue(),
  api.offer_make(uuid, int, text), api.offer_respond(uuid, text), api.offers_mine(), api.favorite_toggle(uuid), api.favorites_mine(), api.review_leave(uuid, int, text),
  api.seller_reputation(text), api.my_entitlements() from public, anon;
grant execute on function api.dm_bundle_publish(text, text, int, text, text, jsonb), api.dm_bundle_get(text), api.dm_prekeys_left(), api.dm_timer_set(uuid, int), api.dm_send2(uuid, jsonb),
  api.verify_submit(text[], text, text, text, text, text, jsonb), api.verify_review(uuid, text, text, text), api.verify_status(), api.verify_queue(),
  api.offer_make(uuid, int, text), api.offer_respond(uuid, text), api.offers_mine(), api.favorite_toggle(uuid), api.favorites_mine(), api.review_leave(uuid, int, text),
  api.seller_reputation(text), api.my_entitlements() to authenticated;
