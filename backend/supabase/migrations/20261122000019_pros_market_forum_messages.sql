-- Migration 19 — Pros et sceau « Encré », marché entre membres, forum « Le Comptoir », messages privés chiffrés, offres (D-113).
-- PRÉPARÉE ET TESTÉE LOCALEMENT (PGlite) ; non appliquée tant que les comptes en ligne (S8) restent fermés. Additive.
-- Principes :
--   * aucun pro n'est « Encré » sans décision d'un membre de l'équipe en double authentification ; les pièces ne sont pas stockées ;
--   * marché réservé aux adultes ; Panel ne détient jamais l'argent : « payé » et « livré » sont posés par le rôle service
--     (prestataire de paiement et transporteur), jamais par un membre ; le taux des frais est un réglage (null = marché fermé) ;
--   * forum : un vote par membre ; séparation adultes / mineurs comme le fil (un adulte ne voit jamais un mineur) ;
--   * messages : le serveur ne stocke que du texte chiffré ; jamais entre mineur et adulte ; ouverts aux adultes seulement ;
--     l'équipe ne lit rien, sauf les messages qu'une personne choisit de joindre à un signalement ;
--   * offres : prix null tant qu'ils ne sont pas décidés ; un abonnement n'est écrit que par le rôle service (paiement).

create schema if not exists pro;
create schema if not exists market;
create schema if not exists forum;
create schema if not exists messaging;
create schema if not exists billing;
grant usage on schema pro, market, forum, messaging, billing to authenticated;

insert into community.limits (action, max_count, per_seconds) values
  ('pro_apply', 3, 86400), ('collab', 10, 86400), ('listing', 30, 86400), ('order', 20, 86400), ('thread', 15, 3600),
  ('comment', 60, 3600), ('forum_vote', 600, 3600), ('dm_open', 20, 86400), ('dm_send', 120, 3600)
on conflict (action) do nothing;

-- ── Pros ────────────────────────────────────────────────────────────────────────────────────────
create table pro.profiles (
  user_id     uuid primary key references community.members (user_id) on delete cascade,
  kind        text not null check (kind in ('creator', 'publisher', 'shop', 'studio')),
  name        text not null check (char_length(name) between 2 and 80),
  roles       text[] not null default '{}' check (roles <@ array['writer', 'artist', 'inker', 'colorist', 'letterer', 'cover', 'editor', 'translator']),
  bio         text not null default '' check (char_length(bio) <= 600),
  links       text[] not null default '{}' check (cardinality(links) <= 6),
  works       jsonb not null default '[]'::jsonb check (pg_catalog.jsonb_typeof(works) = 'array' and pg_catalog.octet_length(works::text) <= 20000),
  open_collab boolean not null default false,
  city        text not null default '' check (char_length(city) <= 60),
  status      text not null default 'draft' check (status in ('draft', 'pending', 'verified', 'refused', 'revoked')),
  verified_at timestamptz,
  verified_by uuid references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now()
);
-- Demande de sceau : la liste cochée et la décision ; aucune pièce justificative n'est stockée
create table pro.applications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references community.members (user_id) on delete cascade,
  kind       text not null,
  ticked     text[] not null default '{}',
  status     text not null default 'open' check (status in ('open', 'accepted', 'refused')),
  decided_by uuid references auth.users (id) on delete set null,
  decision   text not null default '' check (char_length(decision) <= 500),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create unique index applications_one_open on pro.applications (user_id) where status = 'open';
create table pro.collabs (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references community.members (user_id) on delete cascade,
  kind       text not null check (kind in ('seek', 'offer')),
  role       text not null check (role in ('writer', 'artist', 'inker', 'colorist', 'letterer', 'cover', 'editor', 'translator')),
  title      text not null check (char_length(title) between 8 and 100),
  body       text not null check (char_length(body) between 30 and 1500),
  terms      text not null default 'tbd' check (terms in ('paid', 'share', 'volunteer', 'tbd')),
  remote     boolean not null default true,
  city       text not null default '' check (char_length(city) <= 60),
  status     text not null default 'open' check (status in ('open', 'closed', 'removed')),
  created_at timestamptz not null default now()
);

-- ── Marché ──────────────────────────────────────────────────────────────────────────────────────
create table market.settings (
  id          boolean primary key default true check (id),
  fee_rate    numeric(5, 4) check (fee_rate is null or (fee_rate >= 0 and fee_rate < 0.5)),
  auto_days   int not null default 3 check (auto_days between 1 and 30),
  updated_at  timestamptz not null default now()
);
insert into market.settings (id, fee_rate) values (true, null);
create table market.listings (
  id          uuid primary key default gen_random_uuid(),
  seller_id   uuid not null references community.members (user_id) on delete cascade,
  title       text not null check (char_length(title) between 3 and 120),
  issue       text not null default '' check (char_length(issue) <= 20),
  publisher   text not null default '' check (char_length(publisher) <= 80),
  price_cents int not null check (price_cents between 100 and 5000000),
  currency    text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  condition   text not null check (condition in ('nm', 'vf', 'fn', 'vg', 'g', 'fair')),
  delivery    text[] not null check (cardinality(delivery) between 1 and 3 and delivery <@ array['relay', 'parcel', 'hand']),
  city        text not null default '' check (char_length(city) <= 60),
  country     text not null default 'BE' check (country ~ '^[A-Z]{2}$'),
  body        text not null default '' check (char_length(body) <= 1000),
  photos      int not null default 0 check (photos between 0 and 6),
  status      text not null default 'listed' check (status in ('listed', 'reserved', 'sold', 'withdrawn', 'removed')),
  created_at  timestamptz not null default now(),
  check (not ('hand' = any (delivery)) or char_length(city) > 0)
);
create index listings_status on market.listings (status, created_at desc);
create table market.orders (
  id            uuid primary key default gen_random_uuid(),
  listing_id    uuid not null references market.listings (id) on delete cascade,
  buyer_id      uuid references community.members (user_id) on delete set null,
  seller_id     uuid references community.members (user_id) on delete set null,
  state         text not null default 'reserved' check (state in ('reserved', 'paid', 'shipped', 'delivered', 'completed', 'cancelled', 'disputed')),
  delivery      text not null check (delivery in ('relay', 'parcel', 'hand')),
  price_cents   int not null,
  fee_cents     int not null,
  handover_hash text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index orders_one_active on market.orders (listing_id) where state not in ('cancelled');
create table market.order_events (
  id         bigint generated always as identity primary key,
  order_id   uuid not null references market.orders (id) on delete cascade,
  actor_id   uuid references auth.users (id) on delete set null,
  action     text not null,
  from_state text not null,
  to_state   text not null,
  at         timestamptz not null default now()
);

-- ── Le Comptoir ─────────────────────────────────────────────────────────────────────────────────
create table forum.circles (key text primary key, name text not null, position int not null);
insert into forum.circles (key, name, position) values ('debats', 'Débats', 1), ('theories', 'Théories', 2), ('lecture', 'Par où commencer', 3),
  ('sorties', 'Sorties du mercredi', 4), ('collection', 'Collection & cotes', 5), ('vf', 'Comics en VF', 6), ('createurs', 'Coin des créateurs', 7), ('indes', 'Indés & webcomics', 8);
create table forum.threads (
  id         uuid primary key default gen_random_uuid(),
  circle     text not null references forum.circles (key),
  author_id  uuid not null references community.members (user_id) on delete cascade,
  title      text not null check (char_length(title) between 8 and 140),
  body       text not null default '' check (char_length(body) <= 6000),
  flair      text not null default 'question' check (flair in ('debate', 'theory', 'question', 'review', 'news', 'show')),
  sides      text[] not null default '{}' check (cardinality(sides) in (0, 2)),
  spoiler    text not null default '' check (char_length(spoiler) <= 80),
  mature     boolean not null default false,
  status     text not null default 'visible' check (status in ('visible', 'hidden', 'removed', 'deleted')),
  up         int not null default 0, down int not null default 0, side_a int not null default 0, side_b int not null default 0, replies int not null default 0,
  created_at timestamptz not null default now(),
  check ((flair = 'debate') = (cardinality(sides) = 2))
);
create index threads_circle on forum.threads (circle, created_at desc);
create table forum.comments (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references forum.threads (id) on delete cascade,
  parent_id  uuid references forum.comments (id) on delete cascade,
  author_id  uuid not null references community.members (user_id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 3000),
  status     text not null default 'visible' check (status in ('visible', 'hidden', 'removed', 'deleted')),
  up         int not null default 0, down int not null default 0,
  created_at timestamptz not null default now()
);
create index comments_thread on forum.comments (thread_id, created_at);
create table forum.votes (
  user_id   uuid not null references community.members (user_id) on delete cascade,
  target    uuid not null,
  dir       smallint not null check (dir in (-1, 1)),
  primary key (user_id, target)
);
create table forum.side_votes (
  user_id   uuid not null references community.members (user_id) on delete cascade,
  thread_id uuid not null references forum.threads (id) on delete cascade,
  side      smallint not null check (side in (0, 1)),
  primary key (user_id, thread_id)
);
create table forum.reports (
  reporter_id uuid not null references community.members (user_id) on delete cascade,
  target      uuid not null,
  reason      text not null check (reason in ('spam', 'harassment', 'hate', 'sexual', 'minor_safety', 'violence', 'spoiler', 'copyright', 'scam', 'other')),
  created_at  timestamptz not null default now(),
  primary key (reporter_id, target)
);

-- ── Messages chiffrés ───────────────────────────────────────────────────────────────────────────
create table messaging.keys (
  user_id    uuid primary key references community.members (user_id) on delete cascade,
  public_jwk jsonb not null check (public_jwk ?& array['kty', 'crv', 'x', 'y'] and public_jwk ->> 'kty' = 'EC' and public_jwk ->> 'crv' = 'P-256' and pg_catalog.octet_length(public_jwk::text) <= 400),
  updated_at timestamptz not null default now()
);
create table messaging.prefs (
  user_id uuid primary key references community.members (user_id) on delete cascade,
  policy  text not null default 'everyone' check (policy in ('everyone', 'verified', 'nobody'))
);
create table messaging.conversations (
  id           uuid primary key default gen_random_uuid(),
  a            uuid not null references community.members (user_id) on delete cascade,
  b            uuid not null references community.members (user_id) on delete cascade,
  requested_by uuid not null,
  status       text not null default 'request' check (status in ('request', 'active', 'declined', 'closed')),
  created_at   timestamptz not null default now(),
  check (a < b), unique (a, b)
);
-- Seul le texte chiffré est stocké : la forme est contrôlée (v, alg, iv, ct, seq), rien d'autre n'est accepté
create function messaging.box_ok(p jsonb) returns boolean
language sql immutable set search_path = ''
as $$ select pg_catalog.jsonb_typeof(p) = 'object'
  and (select pg_catalog.array_agg(k order by k) from pg_catalog.jsonb_object_keys(p) k) = array['alg', 'ct', 'iv', 'seq', 'v']
  and p ->> 'v' = '1' and p ->> 'alg' = 'ECDH-P256/HKDF-SHA256/AES-GCM-256'
  and (p ->> 'iv') ~ '^[A-Za-z0-9+/]{16}$' and (p ->> 'ct') ~ '^[A-Za-z0-9+/]+=*$' and char_length(p ->> 'ct') between 24 and 4000; $$;
create table messaging.messages (
  id              bigint generated always as identity primary key,
  conversation_id uuid not null references messaging.conversations (id) on delete cascade,
  sender_id       uuid not null references community.members (user_id) on delete cascade,
  seq             int not null check (seq > 0),
  box             jsonb not null check (messaging.box_ok(box)),
  created_at      timestamptz not null default now(),
  unique (conversation_id, sender_id, seq)
);
create table messaging.reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid references community.members (user_id) on delete set null,
  conversation_id uuid references messaging.conversations (id) on delete set null,
  reason          text not null check (reason in ('spam', 'harassment', 'hate', 'sexual', 'minor_safety', 'scam', 'other')),
  disclosed       text[] not null default '{}' check (cardinality(disclosed) <= 20),
  status          text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at      timestamptz not null default now()
);

-- ── Offres ──────────────────────────────────────────────────────────────────────────────────────
create table billing.plans (
  key         text primary key check (key in ('plus', 'creator', 'publisher', 'shop')),
  price_cents int check (price_cents is null or price_cents > 0),
  currency    text not null default 'EUR',
  seal        text check (seal is null or seal in ('creator', 'publisher', 'shop'))
);
insert into billing.plans (key, price_cents, seal) values ('plus', null, null), ('creator', null, 'creator'), ('publisher', null, 'publisher'), ('shop', null, 'shop');
create table billing.subscriptions (
  user_id      uuid not null references auth.users (id) on delete cascade,
  plan         text not null references billing.plans (key),
  status       text not null check (status in ('active', 'past_due', 'cancelled')),
  provider_ref text not null check (char_length(provider_ref) between 1 and 120),
  period_end   timestamptz not null,
  updated_at   timestamptz not null default now(),
  primary key (user_id, plan)
);

do $$ declare t text; begin
  foreach t in array array['pro.profiles', 'pro.applications', 'pro.collabs', 'market.settings', 'market.listings', 'market.orders', 'market.order_events',
    'forum.circles', 'forum.threads', 'forum.comments', 'forum.votes', 'forum.side_votes', 'forum.reports', 'messaging.keys', 'messaging.prefs',
    'messaging.conversations', 'messaging.messages', 'messaging.reports', 'billing.plans', 'billing.subscriptions'] loop
    execute format('alter table %s enable row level security', t);
    execute format('revoke all on %s from public, anon, authenticated', t);
  end loop;
end $$;

-- ── Aides ───────────────────────────────────────────────────────────────────────────────────────
create function pro.require_adult() returns uuid
language plpgsql security definer set search_path = '' stable
as $$ begin
  if auth.uid() is null or not community.member_active(auth.uid()) then raise exception 'not_member' using errcode = '42501'; end if;
  if not community.is_adult(auth.uid()) then raise exception 'adult_only' using errcode = '42501'; end if;
  return auth.uid();
end $$;
-- Un membre en voit-il un autre dans les espaces publics (même règle que le fil : un adulte ne voit jamais un mineur) ?
create function forum.sees(p_viewer uuid, p_author uuid) returns boolean
language sql security definer set search_path = '' stable
as $$ select p_viewer = p_author or (community.member_active(p_author) and not community.blocked_between(p_viewer, p_author)
  and (community.is_adult(p_author) or not community.is_adult(p_viewer))); $$;
create function pro.seal_of(p_user uuid) returns text
language sql security definer set search_path = '' stable
as $$ select p.kind from pro.profiles p where p.user_id = p_user and p.status = 'verified'; $$;
revoke all on function pro.require_adult(), forum.sees(uuid, uuid), pro.seal_of(uuid) from public, anon, authenticated;

-- Guardian (migration 18) : forum = publication ; la politique s'applique aussi aux sujets et réponses
create or replace function guardian.enforce() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare who uuid; act text; r jsonb;
begin
  if auth.uid() is null then return new; end if;
  if tg_table_name in ('posts', 'threads', 'comments') then who := new.author_id; act := 'post';
  elsif tg_table_name = 'follows' then who := new.follower_id; act := 'follow';
  elsif tg_table_name = 'live_rooms' then who := new.host_id; act := 'live_host';
  elsif tg_table_name = 'live_messages' then who := new.author_id; act := 'live_chat';
  else return new; end if;
  r := guardian.evaluate(who, act);
  if not (r ->> 'allowed')::boolean then raise exception 'guardian_%', r ->> 'reason' using errcode = '42501'; end if;
  return new;
end $$;
revoke all on function guardian.enforce() from public, anon, authenticated;
create trigger guardian_threads before insert on forum.threads for each row execute function guardian.enforce();
create trigger guardian_comments before insert on forum.comments for each row execute function guardian.enforce();

-- ── API Pros ────────────────────────────────────────────────────────────────────────────────────
create function api.pro_profile_save(p_kind text, p_name text, p_roles text[], p_bio text, p_links text[], p_works jsonb, p_open boolean, p_city text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := pro.require_adult(); cur pro.profiles;
begin
  if exists (select 1 from pg_catalog.unnest(coalesce(p_links, '{}')) l where l !~* '^https://[^\s<>"]+$') then raise exception 'invalid_link' using errcode = '22023'; end if;
  select * into cur from pro.profiles where user_id = me;
  -- Changer de type ou de nom retire le sceau : il faudra une nouvelle vérification
  insert into pro.profiles (user_id, kind, name, roles, bio, links, works, open_collab, city, status)
    values (me, p_kind, pg_catalog.btrim(p_name), coalesce(p_roles, '{}'), coalesce(p_bio, ''), coalesce(p_links, '{}'), coalesce(p_works, '[]'::jsonb), coalesce(p_open, false), coalesce(p_city, ''), 'draft')
    on conflict (user_id) do update set kind = excluded.kind, name = excluded.name, roles = excluded.roles, bio = excluded.bio, links = excluded.links,
      works = excluded.works, open_collab = excluded.open_collab, city = excluded.city, updated_at = now(),
      status = case when pro.profiles.status = 'verified' and (pro.profiles.kind <> excluded.kind or pro.profiles.name <> excluded.name) then 'draft' else pro.profiles.status end,
      verified_at = case when pro.profiles.status = 'verified' and (pro.profiles.kind <> excluded.kind or pro.profiles.name <> excluded.name) then null else pro.profiles.verified_at end;
  return pg_catalog.jsonb_build_object('status', (select status from pro.profiles where user_id = me));
end $$;

create function api.pro_apply(p_ticked text[]) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := pro.require_adult(); p pro.profiles; need text[];
begin
  select * into p from pro.profiles where user_id = me;
  if not found then raise exception 'profile_required' using errcode = '22023'; end if;
  if p.status = 'verified' then raise exception 'already_verified' using errcode = '22023'; end if;
  need := case p.kind when 'creator' then array['credits', 'portfolio', 'contact'] when 'publisher' then array['company', 'domain', 'mandate', 'site']
    when 'shop' then array['company', 'site', 'contact'] else array['company', 'members', 'credits'] end;
  if not (need <@ coalesce(p_ticked, '{}')) then raise exception 'evidence_missing' using errcode = '22023'; end if;
  perform community.rate_check('pro_apply');
  insert into pro.applications (user_id, kind, ticked) values (me, p.kind, need);
  update pro.profiles set status = 'pending', updated_at = now() where user_id = me;
  return pg_catalog.jsonb_build_object('status', 'pending');
end $$;

create function api.pro_decide(p_user uuid, p_accept boolean, p_decision text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare a pro.applications;
begin
  if not community.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'own_review' using errcode = '42501'; end if;
  if char_length(coalesce(p_decision, '')) < 3 then raise exception 'reason_required' using errcode = '22023'; end if;
  select * into a from pro.applications where user_id = p_user and status = 'open' for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  update pro.applications set status = case when p_accept then 'accepted' else 'refused' end, decided_by = auth.uid(), decision = left(p_decision, 500), decided_at = now() where id = a.id;
  update pro.profiles set status = case when p_accept then 'verified' else 'refused' end, verified_at = case when p_accept then now() end,
    verified_by = case when p_accept then auth.uid() end, updated_at = now() where user_id = p_user;
  return pg_catalog.jsonb_build_object('status', case when p_accept then 'verified' else 'refused' end);
end $$;

create function api.pro_revoke(p_user uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$ begin
  if not community.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(coalesce(p_reason, '')) < 3 then raise exception 'reason_required' using errcode = '22023'; end if;
  update pro.profiles set status = 'revoked', updated_at = now() where user_id = p_user and status = 'verified';
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  return pg_catalog.jsonb_build_object('status', 'revoked');
end $$;

create function api.pro_get(p_handle text) returns jsonb
language sql security definer set search_path = '' stable
as $$
  select pg_catalog.jsonb_build_object('handle', m.handle::text, 'kind', p.kind, 'name', p.name, 'roles', p.roles, 'bio', p.bio, 'links', p.links, 'works', p.works,
    'open', p.open_collab, 'city', p.city, 'seal', case when p.status = 'verified' then p.kind end)
  from community.members m join pro.profiles p on p.user_id = m.user_id
  where m.handle = pg_catalog.btrim(coalesce(p_handle, ''))::extensions.citext and forum.sees(auth.uid(), m.user_id);
$$;

create function api.collab_post(p_kind text, p_role text, p_title text, p_body text, p_terms text, p_remote boolean, p_city text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare me uuid := pro.require_adult(); nid uuid;
begin
  if p_body ~ '[\w.+-]+@[\w-]+\.[\w.]+' or p_body ~ '\+?\d[\d .-]{7,}\d' then raise exception 'contact_refused' using errcode = '22023'; end if;
  perform community.rate_check('collab');
  insert into pro.collabs (author_id, kind, role, title, body, terms, remote, city) values (me, p_kind, p_role, pg_catalog.btrim(p_title), pg_catalog.btrim(p_body), coalesce(p_terms, 'tbd'), coalesce(p_remote, true), coalesce(p_city, ''))
    returning collabs.id into nid;
  return nid;
end $$;

create function api.collab_list(p_role text default null) returns jsonb
language sql security definer set search_path = '' stable
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', c.id, 'kind', c.kind, 'role', c.role, 'title', c.title, 'body', c.body, 'terms', c.terms,
    'remote', c.remote, 'city', c.city, 'author', m.handle::text, 'seal', pro.seal_of(c.author_id), 'at', c.created_at) order by c.created_at desc), '[]'::jsonb)
  from pro.collabs c join community.members m on m.user_id = c.author_id
  where c.status = 'open' and community.is_adult(auth.uid()) and forum.sees(auth.uid(), c.author_id) and (p_role is null or c.role = p_role);
$$;

-- ── API Marché ──────────────────────────────────────────────────────────────────────────────────
create function api.listing_create(p_title text, p_issue text, p_publisher text, p_price_cents int, p_currency text, p_condition text, p_delivery text[], p_city text, p_country text, p_body text, p_photos int) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare me uuid := pro.require_adult(); nid uuid;
begin
  if p_body ~* '[\w.+-]+@[\w-]+\.[\w.]+|\+?\d[\d .-]{7,}\d|virement|paypal|western union|iban' then raise exception 'off_platform_refused' using errcode = '22023'; end if;
  if coalesce(p_photos, 0) < 1 then raise exception 'photo_required' using errcode = '22023'; end if;
  perform community.rate_check('listing');
  insert into market.listings (seller_id, title, issue, publisher, price_cents, currency, condition, delivery, city, country, body, photos)
    values (me, pg_catalog.btrim(p_title), coalesce(p_issue, ''), coalesce(p_publisher, ''), p_price_cents, coalesce(p_currency, 'EUR'), p_condition, p_delivery,
      coalesce(p_city, ''), coalesce(p_country, 'BE'), coalesce(p_body, ''), p_photos) returning listings.id into nid;
  return nid;
end $$;

create function api.listing_withdraw(p_listing uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$ begin
  update market.listings set status = 'withdrawn' where id = p_listing and seller_id = auth.uid() and status = 'listed';
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  return pg_catalog.jsonb_build_object('status', 'withdrawn');
end $$;

create function api.market_list(p_query text default '') returns jsonb
language sql security definer set search_path = '' stable
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', l.id, 'title', l.title, 'issue', l.issue, 'publisher', l.publisher, 'price_cents', l.price_cents,
    'currency', l.currency, 'condition', l.condition, 'delivery', l.delivery, 'city', l.city, 'country', l.country, 'seller', m.handle::text,
    'seal', pro.seal_of(l.seller_id), 'mine', l.seller_id = auth.uid()) order by l.created_at desc), '[]'::jsonb)
  from market.listings l join community.members m on m.user_id = l.seller_id
  where l.status = 'listed' and community.is_adult(auth.uid()) and forum.sees(auth.uid(), l.seller_id)
    and (coalesce(p_query, '') = '' or l.title ilike '%' || pg_catalog.replace(pg_catalog.replace(p_query, '%', ''), '_', '') || '%');
$$;

-- Réserver : l'acheteur choisit le mode de remise ; les frais sont figés au taux du jour (marché fermé si aucun taux n'est fixé)
create function api.order_reserve(p_listing uuid, p_delivery text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := pro.require_adult(); l market.listings; rate numeric; nid uuid;
begin
  select fee_rate into rate from market.settings;
  if rate is null then raise exception 'market_closed' using errcode = '42501'; end if;
  select * into l from market.listings where id = p_listing and status = 'listed' for update;
  if not found or not forum.sees(me, l.seller_id) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if l.seller_id = me then raise exception 'own_listing' using errcode = '22023'; end if;
  if not (p_delivery = any (l.delivery)) then raise exception 'invalid_delivery' using errcode = '22023'; end if;
  perform community.rate_check('order');
  insert into market.orders (listing_id, buyer_id, seller_id, delivery, price_cents, fee_cents)
    values (l.id, me, l.seller_id, p_delivery, l.price_cents, pg_catalog.round(l.price_cents * rate)::int) returning orders.id into nid;
  update market.listings set status = 'reserved' where id = l.id;
  insert into market.order_events (order_id, actor_id, action, from_state, to_state) values (nid, me, 'reserve', 'listed', 'reserved');
  return pg_catalog.jsonb_build_object('order', nid, 'fee_cents', pg_catalog.round(l.price_cents * rate)::int);
end $$;

-- Étapes d'une vente. « pay », « deliver » et « autoconfirm » : rôle service uniquement (prestataire de paiement, transporteur, tâche planifiée)
create function api.order_step(p_order uuid, p_action text, p_code text default null) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare o market.orders; me uuid := auth.uid(); actor text; nxt text;
begin
  select * into o from market.orders where id = p_order for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  actor := case when me is null then 'system' when me = o.buyer_id then 'buyer' when me = o.seller_id then 'seller' when community.is_staff() then 'staff' else 'none' end;
  if actor = 'none' then raise exception 'not_found' using errcode = 'P0002'; end if;
  nxt := case o.state || ':' || p_action
    when 'reserved:release' then 'cancelled' when 'reserved:pay' then case when actor = 'system' then 'paid' end
    when 'paid:ship' then case when actor = 'seller' and o.delivery <> 'hand' then 'shipped' end
    when 'paid:handover' then case when actor = 'seller' and o.delivery = 'hand' then 'completed' end
    when 'shipped:deliver' then case when actor = 'system' then 'delivered' end
    when 'delivered:confirm' then case when actor = 'buyer' then 'completed' end
    when 'delivered:autoconfirm' then case when actor = 'system' then 'completed' end
    when 'paid:cancel' then case when actor = 'seller' then 'cancelled' end
    when 'shipped:dispute' then case when actor = 'buyer' then 'disputed' end
    when 'delivered:dispute' then case when actor = 'buyer' then 'disputed' end
    when 'disputed:resolve_buyer' then case when actor = 'staff' then 'cancelled' end
    when 'disputed:resolve_seller' then case when actor = 'staff' then 'completed' end
  end;
  if nxt is null then raise exception 'invalid_transition' using errcode = '22023'; end if;
  -- Remise en main propre : le vendeur saisit le code que l'acheteur lui donne après avoir vérifié l'exemplaire
  if p_action = 'handover' and (o.handover_hash is null or o.handover_hash <> encode(pg_catalog.sha256(convert_to(coalesce(p_code, ''), 'UTF8')), 'hex')) then
    raise exception 'invalid_code' using errcode = '22023'; end if;
  update market.orders set state = nxt, updated_at = now() where id = o.id;
  update market.listings set status = case when nxt = 'completed' then 'sold' when nxt = 'cancelled' then 'listed' else status end where id = o.listing_id;
  insert into market.order_events (order_id, actor_id, action, from_state, to_state) values (o.id, me, p_action, o.state, nxt);
  return pg_catalog.jsonb_build_object('state', nxt);
end $$;

-- L'acheteur obtient son code de remise (affiché à lui seul) une fois la vente payée
create function api.order_handover_code(p_order uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare o market.orders; code text;
begin
  select * into o from market.orders where id = p_order and buyer_id = auth.uid() and state = 'paid' and delivery = 'hand' for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  code := lpad((('x' || substr(encode(pg_catalog.sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), 1, 8))::bit(32)::bigint % 1000000)::text, 6, '0');
  update market.orders set handover_hash = encode(pg_catalog.sha256(convert_to(code, 'UTF8')), 'hex') where id = o.id;
  return pg_catalog.jsonb_build_object('code', code);
end $$;

-- ── API Le Comptoir ─────────────────────────────────────────────────────────────────────────────
create function api.thread_create(p_circle text, p_title text, p_body text, p_flair text, p_sides text[], p_spoiler text, p_mature boolean) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); nid uuid;
begin
  if me is null or not community.member_active(me) then raise exception 'not_member' using errcode = '42501'; end if;
  if (p_title || coalesce(p_body, '')) ~ '<[a-zA-Z/!]' then raise exception 'markup_refused' using errcode = '22023'; end if;
  perform community.rate_check('thread');
  insert into forum.threads (circle, author_id, title, body, flair, sides, spoiler, mature)
    values (p_circle, me, pg_catalog.btrim(p_title), coalesce(p_body, ''), coalesce(p_flair, 'question'), case when p_flair = 'debate' then coalesce(p_sides, '{}') else '{}' end,
      coalesce(p_spoiler, ''), coalesce(p_mature, false) and community.is_adult(me)) returning threads.id into nid;
  return nid;
end $$;

create function api.comment_create(p_thread uuid, p_parent uuid, p_body text) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); t forum.threads; nid uuid;
begin
  if me is null or not community.member_active(me) then raise exception 'not_member' using errcode = '42501'; end if;
  select * into t from forum.threads where id = p_thread and status = 'visible';
  if not found or not forum.sees(me, t.author_id) or (t.mature and not community.is_adult(me)) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_parent is not null and not exists (select 1 from forum.comments c where c.id = p_parent and c.thread_id = p_thread and forum.sees(me, c.author_id)) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_body ~ '<[a-zA-Z/!]' then raise exception 'markup_refused' using errcode = '22023'; end if;
  perform community.rate_check('comment');
  insert into forum.comments (thread_id, parent_id, author_id, body) values (p_thread, p_parent, me, pg_catalog.btrim(p_body)) returning comments.id into nid;
  update forum.threads set replies = replies + 1 where forum.threads.id = p_thread;
  return nid;
end $$;

-- Vote : un par membre et par contenu ; recliquer annule ; jamais sur son propre contenu
create function api.forum_vote(p_target uuid, p_dir int) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); prev int; nxt int; author uuid; is_thread boolean;
begin
  if me is null or not community.member_active(me) then raise exception 'not_member' using errcode = '42501'; end if;
  select author_id, true into author, is_thread from forum.threads where id = p_target and status = 'visible';
  if not found then select author_id, false into author, is_thread from forum.comments where id = p_target and status = 'visible'; end if;
  if author is null or not forum.sees(me, author) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if author = me then raise exception 'own_content' using errcode = '22023'; end if;
  perform community.rate_check('forum_vote');
  select dir into prev from forum.votes where user_id = me and target = p_target;
  prev := coalesce(prev, 0);
  nxt := case when sign(p_dir) = prev then 0 else sign(p_dir)::int end;
  if nxt = 0 then delete from forum.votes where user_id = me and target = p_target;
  else insert into forum.votes (user_id, target, dir) values (me, p_target, nxt) on conflict (user_id, target) do update set dir = excluded.dir; end if;
  if is_thread then update forum.threads set up = up + ((nxt = 1)::int - (prev = 1)::int), down = down + ((nxt = -1)::int - (prev = -1)::int) where id = p_target;
  else update forum.comments set up = up + ((nxt = 1)::int - (prev = 1)::int), down = down + ((nxt = -1)::int - (prev = -1)::int) where id = p_target; end if;
  return pg_catalog.jsonb_build_object('dir', nxt);
end $$;

create function api.forum_side(p_thread uuid, p_side int) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); t forum.threads; prev int;
begin
  select * into t from forum.threads where id = p_thread and status = 'visible' and flair = 'debate';
  if not found or me is null or not forum.sees(me, t.author_id) then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_side not in (0, 1) then raise exception 'invalid_side' using errcode = '22023'; end if;
  perform community.rate_check('forum_vote');
  select side into prev from forum.side_votes where user_id = me and thread_id = p_thread;
  insert into forum.side_votes (user_id, thread_id, side) values (me, p_thread, p_side) on conflict (user_id, thread_id) do update set side = excluded.side;
  update forum.threads set side_a = side_a + (p_side = 0)::int - coalesce((prev = 0)::int, 0), side_b = side_b + (p_side = 1)::int - coalesce((prev = 1)::int, 0) where id = p_thread;
  return pg_catalog.jsonb_build_object('side', p_side);
end $$;

create function api.forum_threads(p_circle text default null) returns jsonb
language sql security definer set search_path = '' stable
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', t.id, 'circle', t.circle, 'title', t.title, 'body', case when t.spoiler <> '' then '' else t.body end,
    'flair', t.flair, 'sides', t.sides, 'spoiler', t.spoiler, 'up', t.up, 'down', t.down, 'sideA', t.side_a, 'sideB', t.side_b, 'replies', t.replies,
    'at', t.created_at, 'author', m.handle::text, 'seal', pro.seal_of(t.author_id), 'mature', t.mature) order by t.created_at desc), '[]'::jsonb)
  from forum.threads t join community.members m on m.user_id = t.author_id
  where t.status = 'visible' and forum.sees(auth.uid(), t.author_id) and (not t.mature or community.is_adult(auth.uid())) and (p_circle is null or t.circle = p_circle);
$$;

create function api.forum_comments(p_thread uuid) returns jsonb
language sql security definer set search_path = '' stable
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', c.id, 'parent', c.parent_id, 'body', c.body, 'up', c.up, 'down', c.down, 'at', c.created_at,
    'author', m.handle::text, 'seal', pro.seal_of(c.author_id)) order by c.created_at), '[]'::jsonb)
  from forum.comments c join community.members m on m.user_id = c.author_id join forum.threads t on t.id = c.thread_id
  where c.thread_id = p_thread and c.status = 'visible' and t.status = 'visible' and forum.sees(auth.uid(), t.author_id) and forum.sees(auth.uid(), c.author_id)
    and (not t.mature or community.is_adult(auth.uid()));
$$;

-- Signalement : masquage au troisième signalement, immédiat pour la sécurité d'un mineur
create function api.forum_report(p_target uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); n int;
begin
  if me is null or not community.member_active(me) then raise exception 'not_member' using errcode = '42501'; end if;
  if not exists (select 1 from forum.threads where id = p_target) and not exists (select 1 from forum.comments where id = p_target) then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform community.rate_check('report');
  insert into forum.reports (reporter_id, target, reason) values (me, p_target, p_reason) on conflict do nothing;
  select count(*) into n from forum.reports where target = p_target;
  if n >= 3 or p_reason = 'minor_safety' then
    update forum.threads set status = 'hidden' where id = p_target and status = 'visible';
    update forum.comments set status = 'hidden' where id = p_target and status = 'visible';
  end if;
  return pg_catalog.jsonb_build_object('hidden', n >= 3 or p_reason = 'minor_safety');
end $$;

-- ── API Messages chiffrés ───────────────────────────────────────────────────────────────────────
create function messaging.can(p_me uuid, p_them uuid) returns text
language plpgsql security definer set search_path = '' stable
as $$
declare pol text;
begin
  if p_me is null or p_them is null or p_me = p_them or not community.member_active(p_me) or not community.member_active(p_them) then return 'invalid'; end if;
  if community.blocked_between(p_me, p_them) then return 'blocked'; end if;
  if not community.is_adult(p_me) or not community.is_adult(p_them) then return 'minor_protected'; end if;
  select policy into pol from messaging.prefs where user_id = p_them;
  if pol = 'nobody' then return 'closed'; end if;
  if pol = 'verified' and pro.seal_of(p_me) is null then return 'verified_only'; end if;
  return '';
end $$;
revoke all on function messaging.can(uuid, uuid) from public, anon, authenticated;

create function api.dm_key_set(p_jwk jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$ begin
  perform pro.require_adult();
  insert into messaging.keys (user_id, public_jwk) values (auth.uid(), pg_catalog.jsonb_build_object('kty', p_jwk ->> 'kty', 'crv', p_jwk ->> 'crv', 'x', p_jwk ->> 'x', 'y', p_jwk ->> 'y'))
    on conflict (user_id) do update set public_jwk = excluded.public_jwk, updated_at = now();
  return pg_catalog.jsonb_build_object('status', 'saved');
end $$;

create function api.dm_prefs_set(p_policy text) returns jsonb
language plpgsql security definer set search_path = ''
as $$ begin
  if auth.uid() is null or not community.member_active(auth.uid()) then raise exception 'not_member' using errcode = '42501'; end if;
  insert into messaging.prefs (user_id, policy) values (auth.uid(), p_policy) on conflict (user_id) do update set policy = excluded.policy;
  return pg_catalog.jsonb_build_object('policy', p_policy);
end $$;

-- Ouvrir une conversation (une demande tant que l'autre n'a pas accepté, sauf abonnement mutuel)
create function api.dm_open(p_handle text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); them uuid; why text; c messaging.conversations; mutual boolean; k jsonb;
begin
  select user_id into them from community.members where handle = pg_catalog.btrim(coalesce(p_handle, ''))::extensions.citext;
  why := messaging.can(me, them);
  if why <> '' then raise exception '%', why using errcode = '42501'; end if;
  select public_jwk into k from messaging.keys where user_id = them;
  if k is null then raise exception 'no_key' using errcode = '22023'; end if;
  select * into c from messaging.conversations where a = least(me, them) and b = greatest(me, them);
  if not found then
    perform community.rate_check('dm_open');
    mutual := exists (select 1 from community.follows f where f.follower_id = me and f.followee_id = them) and exists (select 1 from community.follows f where f.follower_id = them and f.followee_id = me);
    insert into messaging.conversations (a, b, requested_by, status) values (least(me, them), greatest(me, them), me, case when mutual then 'active' else 'request' end) returning * into c;
  end if;
  return pg_catalog.jsonb_build_object('id', c.id, 'status', c.status, 'their_key', k);
end $$;

create function api.dm_respond(p_conversation uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = ''
as $$ begin
  update messaging.conversations set status = case when p_accept then 'active' else 'declined' end
    where id = p_conversation and status = 'request' and requested_by <> auth.uid() and auth.uid() in (a, b);
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  return pg_catalog.jsonb_build_object('status', case when p_accept then 'active' else 'declined' end);
end $$;

-- Envoi : seulement du chiffré ; pendant une demande, un seul message de celui qui demande
create function api.dm_send(p_conversation uuid, p_box jsonb) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); c messaging.conversations; other uuid; why text; nid bigint;
begin
  select * into c from messaging.conversations where id = p_conversation and me in (a, b);
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  other := case when c.a = me then c.b else c.a end;
  why := messaging.can(me, other);
  if why <> '' then raise exception '%', why using errcode = '42501'; end if;
  if c.status in ('declined', 'closed') then raise exception 'closed' using errcode = '42501'; end if;
  if c.status = 'request' and (c.requested_by <> me or exists (select 1 from messaging.messages m where m.conversation_id = c.id)) then raise exception 'request_pending' using errcode = '42501'; end if;
  perform community.rate_check('dm_send');
  insert into messaging.messages (conversation_id, sender_id, seq, box) values (c.id, me, (p_box ->> 'seq')::int, p_box) returning messages.id into nid;
  return nid;
end $$;

create function api.dm_messages(p_conversation uuid, p_after bigint default 0) returns jsonb
language sql security definer set search_path = '' stable
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', m.id, 'sender', case when m.sender_id = auth.uid() then 'me' else 'them' end, 'box', m.box, 'at', m.created_at) order by m.id), '[]'::jsonb)
  from messaging.messages m join messaging.conversations c on c.id = m.conversation_id
  where c.id = p_conversation and auth.uid() in (c.a, c.b) and m.id > coalesce(p_after, 0);
$$;

create function api.dm_list() returns jsonb
language sql security definer set search_path = '' stable
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', c.id, 'status', c.status, 'mine', c.requested_by = auth.uid(), 'with', m.handle::text,
    'seal', pro.seal_of(m.user_id), 'key', k.public_jwk) order by c.created_at desc), '[]'::jsonb)
  from messaging.conversations c join community.members m on m.user_id = case when c.a = auth.uid() then c.b else c.a end
  left join messaging.keys k on k.user_id = m.user_id
  where auth.uid() in (c.a, c.b) and not community.blocked_between(c.a, c.b);
$$;

-- Signalement : la personne choisit les messages qu'elle déchiffre et transmet ; l'équipe ne voit rien d'autre
create function api.dm_report(p_conversation uuid, p_reason text, p_disclosed text[]) returns jsonb
language plpgsql security definer set search_path = ''
as $$ begin
  if not exists (select 1 from messaging.conversations c where c.id = p_conversation and auth.uid() in (c.a, c.b)) then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform community.rate_check('report');
  insert into messaging.reports (reporter_id, conversation_id, reason, disclosed)
    values (auth.uid(), p_conversation, p_reason, (select coalesce(pg_catalog.array_agg(left(d, 2000)), '{}') from pg_catalog.unnest(coalesce(p_disclosed, '{}')) d));
  update messaging.conversations set status = 'closed' where id = p_conversation;
  return pg_catalog.jsonb_build_object('status', 'reported');
end $$;

-- ── API Offres ──────────────────────────────────────────────────────────────────────────────────
create function api.my_plans() returns jsonb
language sql security definer set search_path = '' stable
as $$
  select pg_catalog.jsonb_build_object(
    'plans', (select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('key', p.key, 'price_cents', p.price_cents, 'currency', p.currency, 'seal', p.seal) order by p.key) from billing.plans p),
    'active', (select coalesce(pg_catalog.jsonb_agg(s.plan), '[]'::jsonb) from billing.subscriptions s where s.user_id = auth.uid() and s.status = 'active' and s.period_end > now()));
$$;

revoke all on function api.pro_profile_save(text, text, text[], text, text[], jsonb, boolean, text), api.pro_apply(text[]), api.pro_decide(uuid, boolean, text), api.pro_revoke(uuid, text),
  api.pro_get(text), api.collab_post(text, text, text, text, text, boolean, text), api.collab_list(text),
  api.listing_create(text, text, text, int, text, text, text[], text, text, text, int), api.listing_withdraw(uuid), api.market_list(text), api.order_reserve(uuid, text),
  api.order_step(uuid, text, text), api.order_handover_code(uuid), api.thread_create(text, text, text, text, text[], text, boolean), api.comment_create(uuid, uuid, text),
  api.forum_vote(uuid, int), api.forum_side(uuid, int), api.forum_threads(text), api.forum_comments(uuid), api.forum_report(uuid, text),
  api.dm_key_set(jsonb), api.dm_prefs_set(text), api.dm_open(text), api.dm_respond(uuid, boolean), api.dm_send(uuid, jsonb), api.dm_messages(uuid, bigint), api.dm_list(),
  api.dm_report(uuid, text, text[]), api.my_plans() from public, anon;
grant execute on function api.pro_profile_save(text, text, text[], text, text[], jsonb, boolean, text), api.pro_apply(text[]), api.pro_decide(uuid, boolean, text), api.pro_revoke(uuid, text),
  api.pro_get(text), api.collab_post(text, text, text, text, text, boolean, text), api.collab_list(text),
  api.listing_create(text, text, text, int, text, text, text[], text, text, text, int), api.listing_withdraw(uuid), api.market_list(text), api.order_reserve(uuid, text),
  api.order_step(uuid, text, text), api.order_handover_code(uuid), api.thread_create(text, text, text, text, text[], text, boolean), api.comment_create(uuid, uuid, text),
  api.forum_vote(uuid, int), api.forum_side(uuid, int), api.forum_threads(text), api.forum_comments(uuid), api.forum_report(uuid, text),
  api.dm_key_set(jsonb), api.dm_prefs_set(text), api.dm_open(text), api.dm_respond(uuid, boolean), api.dm_send(uuid, jsonb), api.dm_messages(uuid, bigint), api.dm_list(),
  api.dm_report(uuid, text, text[]), api.my_plans() to authenticated;
