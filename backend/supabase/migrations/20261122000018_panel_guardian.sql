-- Migration 18 — Panel Guardian (D-111) : statut d'âge contestable, supervision parentale, restrictions de compte,
-- politique centrale côté serveur. TESTÉE LOCALEMENT (PGlite) ;
-- APPLIQUÉE EN PRÉPRODUCTION le 22/11/2026 (D-116), comptes en ligne (S8) toujours fermés.
--
-- Principes (décisions produit) :
--   * aucun compte de moins de 13 ans, même avec accord parental (déjà refusé par api.community_join, migration 13) ;
--   * 13-17 ans : supervision renforcée ; la tranche d'âge suffit, la date de naissance n'est pas conservée ;
--   * l'âge déclaré n'est jamais présenté comme vérifié : statut « unverified » + tranche déclarée ; un prestataire de preuve
--     d'âge pourra plus tard poser un statut « verified_* » (rôle service uniquement) ;
--   * aucune biométrie, aucune reconnaissance faciale, aucune lecture des messages : le parent règle des limites, il ne lit rien ;
--   * toute décision d'âge contestée passe par un humain de l'équipe (double authentification, migration 17) ;
--   * la politique est évaluée ici, côté serveur ; l'application ne fait qu'afficher le résultat.

create schema if not exists guardian;
grant usage on schema guardian to authenticated;

-- ── Statut d'âge ────────────────────────────────────────────────────────────────────────────────
create table guardian.age_assurances (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  status      text not null default 'unverified' check (status in ('unverified', 'verified_13_15', 'verified_16_17', 'verified_adult', 'under_13_blocked', 'review_required')),
  method      text not null default 'self_declared' check (method in ('self_declared', 'provider', 'staff_review')),
  updated_at  timestamptz not null default now()
);

-- Contestation d'une tranche d'âge : examinée par l'équipe, jamais décidée par un algorithme seul
create table guardian.age_reviews (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  requested    text not null check (requested in ('13-14', '15-17', '18+')),
  reason       text not null check (char_length(reason) between 10 and 500),
  status       text not null default 'open' check (status in ('open', 'accepted', 'refused')),
  decided_by   uuid references auth.users (id) on delete set null,
  decision     text not null default '' check (char_length(decision) <= 500),
  created_at   timestamptz not null default now(),
  decided_at   timestamptz
);
create unique index age_reviews_one_open on guardian.age_reviews (user_id) where status = 'open';

-- ── Supervision parentale ─────────────────────────────────────────────────────────────────────
-- Le lien part TOUJOURS du compte mineur (code à usage unique, 48 h) : un inconnu ne peut pas « réclamer » un enfant.
create table guardian.links (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references auth.users (id) on delete cascade,
  guardian_id  uuid references auth.users (id) on delete cascade,
  code_hash    text not null,
  status       text not null default 'pending' check (status in ('pending', 'active', 'revoked', 'expired')),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '48 hours',
  activated_at timestamptz,
  revoked_at   timestamptz,
  revoked_by   uuid references auth.users (id) on delete set null,
  check (guardian_id is null or guardian_id <> child_id)
);
create index links_child on guardian.links (child_id, status);

-- Réglages posés par un parent (plus stricts seulement) ; le mineur les voit, il ne les modifie pas
create table guardian.settings (
  child_id        uuid primary key references auth.users (id) on delete cascade,
  quiet_start     smallint check (quiet_start between 0 and 23),
  quiet_end       smallint check (quiet_end between 0 and 23),
  time_zone       text not null default 'Europe/Brussels' check (char_length(time_zone) <= 60),
  live_join       boolean not null default true,
  live_host       boolean not null default true,
  follows_open    boolean not null default true,
  updated_by      uuid references auth.users (id) on delete set null,
  updated_at      timestamptz not null default now()
);

-- Restrictions de compte décidées par l'équipe (mesures proportionnées et datées, motif obligatoire)
create table guardian.restrictions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('no_post', 'no_live', 'no_follow', 'read_only')),
  reason      text not null check (char_length(reason) between 3 and 500),
  until       timestamptz,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  lifted_at   timestamptz
);
create index restrictions_user on guardian.restrictions (user_id) where lifted_at is null;

-- Journal Guardian (qui a fait quoi, jamais le contenu des échanges)
create table guardian.events (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users (id) on delete cascade,
  actor_id   uuid references auth.users (id) on delete set null,
  kind       text not null check (char_length(kind) <= 40),
  detail     jsonb not null default '{}'::jsonb check (pg_catalog.octet_length(detail::text) <= 2000),
  created_at timestamptz not null default now()
);

alter table guardian.age_assurances enable row level security;
alter table guardian.age_reviews enable row level security;
alter table guardian.links enable row level security;
alter table guardian.settings enable row level security;
alter table guardian.restrictions enable row level security;
alter table guardian.events enable row level security;
-- Aucun accès direct aux tables : tout passe par les fonctions api.* ci-dessous
revoke all on all tables in schema guardian from public, anon, authenticated;

-- ── Aides internes ─────────────────────────────────────────────────────────────────────────────
create function guardian.band(p_user uuid) returns text
language sql security definer set search_path = '' stable
as $$ select m.age_band from community.members m where m.user_id = p_user; $$;

create function guardian.log(p_user uuid, p_kind text, p_detail jsonb default '{}'::jsonb) returns void
language sql security definer set search_path = ''
as $$ insert into guardian.events (user_id, actor_id, kind, detail) values (p_user, auth.uid(), p_kind, coalesce(p_detail, '{}'::jsonb)); $$;

create function guardian.is_guardian_of(p_guardian uuid, p_child uuid) returns boolean
language sql security definer set search_path = '' stable
as $$ select exists (select 1 from guardian.links l where l.guardian_id = p_guardian and l.child_id = p_child and l.status = 'active'); $$;

create function guardian.restricted(p_user uuid, p_kind text) returns boolean
language sql security definer set search_path = '' stable
as $$ select exists (select 1 from guardian.restrictions r where r.user_id = p_user and r.lifted_at is null
          and (r.until is null or r.until > now()) and (r.kind = p_kind or r.kind = 'read_only')); $$;

create function guardian.in_quiet_hours(p_user uuid) returns boolean
language plpgsql security definer set search_path = '' stable
as $$
declare s guardian.settings; h int;
begin
  select * into s from guardian.settings where child_id = p_user;
  if not found or s.quiet_start is null or s.quiet_end is null or s.quiet_start = s.quiet_end then return false; end if;
  h := extract(hour from (now() at time zone s.time_zone))::int;
  return case when s.quiet_start < s.quiet_end then h >= s.quiet_start and h < s.quiet_end else h >= s.quiet_start or h < s.quiet_end end;
end $$;

revoke all on function guardian.band(uuid), guardian.log(uuid, text, jsonb), guardian.is_guardian_of(uuid, uuid), guardian.restricted(uuid, text), guardian.in_quiet_hours(uuid) from public, anon, authenticated;

-- ── Politique centrale ─────────────────────────────────────────────────────────────────────────
-- Actions : post, follow, live_join, live_host, live_chat. Renvoie { allowed, reason } ; utilisée par les déclencheurs.
create function guardian.evaluate(p_user uuid, p_action text) returns jsonb
language plpgsql security definer set search_path = '' stable
as $$
declare band text; st text; s guardian.settings;
begin
  if p_action not in ('post', 'follow', 'live_join', 'live_host', 'live_chat') then return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'unknown_action'); end if;
  band := guardian.band(p_user);
  if band is null then return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'not_member'); end if;
  select status into st from guardian.age_assurances where user_id = p_user;
  if st in ('under_13_blocked') then return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'under_13'); end if;
  if st = 'review_required' and p_action in ('live_host', 'live_join', 'live_chat') then return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'age_review_pending'); end if;
  if guardian.restricted(p_user, case p_action when 'post' then 'no_post' when 'follow' then 'no_follow' else 'no_live' end) then
    return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'restricted'); end if;
  if band <> '18+' then
    if guardian.in_quiet_hours(p_user) then return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'quiet_hours'); end if;
    select * into s from guardian.settings where child_id = p_user;
    -- 13-14 ans : animer un direct est fermé ; 15-17 ans : ouvert (salon visible des seuls mineurs, migration 14) sauf si un parent relié le coupe
    if p_action = 'live_host' and (band = '13-14' or (found and not s.live_host)) then return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'minor_live_host'); end if;
    if p_action in ('live_join', 'live_chat') and found and not s.live_join then return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'guardian_live_off'); end if;
    if p_action = 'follow' and found and not s.follows_open then return pg_catalog.jsonb_build_object('allowed', false, 'reason', 'guardian_follows_off'); end if;
  end if;
  return pg_catalog.jsonb_build_object('allowed', true, 'reason', '');
end $$;
revoke all on function guardian.evaluate(uuid, text) from public, anon, authenticated;

-- Point d'entrée lisible par l'application (pour griser un bouton) : la décision reste celle des déclencheurs
create function api.guardian_can(p_action text) returns jsonb
language sql security definer set search_path = '' stable
as $$ select guardian.evaluate(auth.uid(), p_action); $$;

-- Déclencheurs : la politique s'applique à toute écriture, y compris par un appel direct à l'API
create function guardian.enforce() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare who uuid; act text; r jsonb;
begin
  if auth.uid() is null then return new; end if; -- rôle service (maintenance, purge) : hors politique utilisateur
  if tg_table_name = 'posts' then who := new.author_id; act := 'post';
  elsif tg_table_name = 'follows' then who := new.follower_id; act := 'follow';
  elsif tg_table_name = 'live_rooms' then who := new.host_id; act := 'live_host';
  elsif tg_table_name = 'live_messages' then who := new.author_id; act := 'live_chat';
  else return new; end if;
  r := guardian.evaluate(who, act);
  if not (r ->> 'allowed')::boolean then raise exception 'guardian_%', r ->> 'reason' using errcode = '42501'; end if;
  return new;
end $$;
revoke all on function guardian.enforce() from public, anon, authenticated;

create trigger guardian_posts before insert on community.posts for each row execute function guardian.enforce();
create trigger guardian_follows before insert on community.follows for each row execute function guardian.enforce();
create trigger guardian_live_rooms before insert on community.live_rooms for each row execute function guardian.enforce();
create trigger guardian_live_messages before insert on community.live_messages for each row execute function guardian.enforce();

-- Statut d'âge créé à l'adhésion (déclaratif, donc « unverified »)
create function guardian.on_member() returns trigger
language plpgsql security definer set search_path = ''
as $$ begin
  insert into guardian.age_assurances (user_id, status, method) values (new.user_id, 'unverified', 'self_declared') on conflict (user_id) do nothing;
  return new;
end $$;
revoke all on function guardian.on_member() from public, anon, authenticated;
create trigger guardian_member after insert on community.members for each row execute function guardian.on_member();

-- ── API : mon statut, contestation ──────────────────────────────────────────────────────────────
create function api.guardian_status() returns jsonb
language plpgsql security definer set search_path = '' stable
as $$
declare me uuid := auth.uid(); a guardian.age_assurances; s guardian.settings;
begin
  if me is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  select * into a from guardian.age_assurances where user_id = me;
  select * into s from guardian.settings where child_id = me;
  return pg_catalog.jsonb_build_object(
    'band', guardian.band(me), 'status', coalesce(a.status, 'unverified'), 'method', coalesce(a.method, 'self_declared'),
    'guardians', (select count(*) from guardian.links l where l.child_id = me and l.status = 'active'),
    'children', (select count(*) from guardian.links l where l.guardian_id = me and l.status = 'active'),
    'settings', case when s.child_id is null then null else pg_catalog.jsonb_build_object('quiet_start', s.quiet_start, 'quiet_end', s.quiet_end, 'live_join', s.live_join, 'live_host', s.live_host, 'follows_open', s.follows_open) end,
    'review_open', exists (select 1 from guardian.age_reviews r where r.user_id = me and r.status = 'open'));
end $$;

create function api.age_review_request(p_band text, p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); id uuid;
begin
  if me is null or guardian.band(me) is null then raise exception 'not_member' using errcode = '42501'; end if;
  if p_band not in ('13-14', '15-17', '18+') or p_band = guardian.band(me) then raise exception 'invalid_band' using errcode = '22023'; end if;
  if char_length(coalesce(p_reason, '')) < 10 then raise exception 'reason_required' using errcode = '22023'; end if;
  insert into guardian.age_reviews (user_id, requested, reason) values (me, p_band, left(p_reason, 500)) returning age_reviews.id into id;
  -- Une demande vers une tranche plus âgée suspend les directs le temps de l'examen (contournement de l'âge)
  if p_band = '18+' or (p_band = '15-17' and guardian.band(me) = '13-14') then
    update guardian.age_assurances set status = 'review_required', updated_at = now() where user_id = me;
  end if;
  perform guardian.log(me, 'age_review_request', pg_catalog.jsonb_build_object('requested', p_band));
  return pg_catalog.jsonb_build_object('id', id, 'status', 'open');
end $$;

-- Décision humaine (équipe en double authentification) ; un refus rétablit le statut déclaratif
create function api.age_review_decide(p_review uuid, p_accept boolean, p_decision text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare r guardian.age_reviews;
begin
  if not community.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  if char_length(coalesce(p_decision, '')) < 3 then raise exception 'reason_required' using errcode = '22023'; end if;
  select * into r from guardian.age_reviews where id = p_review and status = 'open' for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if r.user_id = auth.uid() then raise exception 'own_review' using errcode = '42501'; end if;
  update guardian.age_reviews set status = case when p_accept then 'accepted' else 'refused' end, decided_by = auth.uid(), decision = left(p_decision, 500), decided_at = now() where id = r.id;
  if p_accept then
    update community.members set age_band = r.requested, parental_consent = (r.requested = '13-14' or parental_consent),
      visibility = case when r.requested = '18+' then visibility else 'private' end, updated_at = now() where user_id = r.user_id;
    update guardian.age_assurances set status = 'unverified', method = 'staff_review', updated_at = now() where user_id = r.user_id;
  else
    update guardian.age_assurances set status = 'unverified', updated_at = now() where user_id = r.user_id;
  end if;
  perform guardian.log(r.user_id, 'age_review_decided', pg_catalog.jsonb_build_object('accepted', p_accept));
  return pg_catalog.jsonb_build_object('status', case when p_accept then 'accepted' else 'refused' end);
end $$;

-- ── API : supervision parentale ─────────────────────────────────────────────────────────────────
-- 1. Le mineur crée un code (affiché une fois, à donner à son parent en personne)
create function api.guardian_link_create() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); code text;
begin
  if me is null or guardian.band(me) is null then raise exception 'not_member' using errcode = '42501'; end if;
  if guardian.band(me) = '18+' then raise exception 'adult_account' using errcode = '42501'; end if;
  if (select count(*) from guardian.links l where l.child_id = me and l.status = 'active') >= 2 then raise exception 'max_guardians' using errcode = '22023'; end if;
  update guardian.links set status = 'expired' where child_id = me and status = 'pending';
  code := upper(substr(encode(pg_catalog.sha256(convert_to(gen_random_uuid()::text, 'UTF8')), 'hex'), 1, 10));
  insert into guardian.links (child_id, code_hash) values (me, encode(pg_catalog.sha256(convert_to(code, 'UTF8')), 'hex'));
  perform guardian.log(me, 'guardian_code_created');
  return pg_catalog.jsonb_build_object('code', code, 'expires_in_hours', 48);
end $$;

-- 2. Le parent (compte adulte, en double authentification) saisit le code
create function api.guardian_link_accept(p_code text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); l guardian.links;
begin
  if me is null or guardian.band(me) is distinct from '18+' then raise exception 'adult_required' using errcode = '42501'; end if;
  if not app.mfa_ok() then raise exception 'mfa_required' using errcode = '42501'; end if;
  perform community.rate_check('guardian_code');
  select * into l from guardian.links where code_hash = encode(pg_catalog.sha256(convert_to(upper(coalesce(p_code, '')), 'UTF8')), 'hex') and status = 'pending' for update;
  if not found or l.expires_at < now() then raise exception 'invalid_code' using errcode = '22023'; end if;
  if l.child_id = me then raise exception 'invalid_code' using errcode = '22023'; end if;
  update guardian.links set guardian_id = me, status = 'active', activated_at = now() where id = l.id;
  insert into guardian.settings (child_id, updated_by) values (l.child_id, me) on conflict (child_id) do nothing;
  perform guardian.log(l.child_id, 'guardian_linked');
  return pg_catalog.jsonb_build_object('status', 'active');
end $$;

-- 3. Réglages : seulement par un parent relié ; jamais d'accès aux publications privées, aux directs ou aux messages
create function api.guardian_settings_set(p_child uuid, p_quiet_start int, p_quiet_end int, p_live_join boolean, p_live_host boolean, p_follows_open boolean) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not guardian.is_guardian_of(auth.uid(), p_child) then raise exception 'forbidden' using errcode = '42501'; end if;
  if not app.mfa_ok() then raise exception 'mfa_required' using errcode = '42501'; end if;
  if (p_quiet_start is null) <> (p_quiet_end is null) or p_quiet_start not between 0 and 23 or p_quiet_end not between 0 and 23 then raise exception 'invalid_hours' using errcode = '22023'; end if;
  insert into guardian.settings (child_id, quiet_start, quiet_end, live_join, live_host, follows_open, updated_by, updated_at)
    values (p_child, p_quiet_start, p_quiet_end, coalesce(p_live_join, true), coalesce(p_live_host, true) and guardian.band(p_child) = '15-17', coalesce(p_follows_open, true), auth.uid(), now())
    on conflict (child_id) do update set quiet_start = excluded.quiet_start, quiet_end = excluded.quiet_end, live_join = excluded.live_join,
      live_host = excluded.live_host, follows_open = excluded.follows_open, updated_by = excluded.updated_by, updated_at = now();
  perform guardian.log(p_child, 'guardian_settings');
  return pg_catalog.jsonb_build_object('status', 'saved');
end $$;

-- 4. Révocation : par le parent, ou par le mineur à sa majorité ; l'équipe peut aussi révoquer (conflit, compte compromis)
create function api.guardian_link_revoke(p_link uuid, p_reason text default '') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare l guardian.links; me uuid := auth.uid();
begin
  select * into l from guardian.links where id = p_link and status = 'active' for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not (l.guardian_id = me or (l.child_id = me and guardian.band(me) = '18+') or community.is_staff()) then raise exception 'forbidden' using errcode = '42501'; end if;
  update guardian.links set status = 'revoked', revoked_at = now(), revoked_by = me where id = l.id;
  if not exists (select 1 from guardian.links x where x.child_id = l.child_id and x.status = 'active') then delete from guardian.settings where child_id = l.child_id; end if;
  perform guardian.log(l.child_id, 'guardian_revoked', pg_catalog.jsonb_build_object('reason', left(coalesce(p_reason, ''), 200)));
  return pg_catalog.jsonb_build_object('status', 'revoked');
end $$;

-- 5. Liste des liens (parent : ses enfants, pseudo seulement ; mineur : nombre de parents reliés)
create function api.guardian_links() returns jsonb
language sql security definer set search_path = '' stable
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', l.id, 'role', case when l.guardian_id = auth.uid() then 'guardian' else 'child' end,
    'handle', case when l.guardian_id = auth.uid() then (select m.handle::text from community.members m where m.user_id = l.child_id) else null end,
    'since', l.activated_at) order by l.activated_at), '[]'::jsonb)
  from guardian.links l where l.status = 'active' and (l.guardian_id = auth.uid() or l.child_id = auth.uid());
$$;

-- ── API équipe : restrictions proportionnées ────────────────────────────────────────────────────
create function api.restriction_set(p_user uuid, p_kind text, p_reason text, p_days int default 7) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare id uuid;
begin
  if not community.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'own_account' using errcode = '42501'; end if;
  if p_kind not in ('no_post', 'no_live', 'no_follow', 'read_only') or char_length(coalesce(p_reason, '')) < 3 then raise exception 'invalid' using errcode = '22023'; end if;
  insert into guardian.restrictions (user_id, kind, reason, until, created_by)
    values (p_user, p_kind, left(p_reason, 500), case when p_days is null then null else now() + make_interval(days => least(greatest(p_days, 1), 365)) end, auth.uid()) returning restrictions.id into id;
  perform guardian.log(p_user, 'restriction_set', pg_catalog.jsonb_build_object('kind', p_kind, 'days', p_days));
  return pg_catalog.jsonb_build_object('id', id);
end $$;

create function api.restriction_lift(p_restriction uuid, p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare r guardian.restrictions;
begin
  if not community.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  update guardian.restrictions set lifted_at = now() where id = p_restriction and lifted_at is null returning * into r;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  perform guardian.log(r.user_id, 'restriction_lifted', pg_catalog.jsonb_build_object('reason', left(coalesce(p_reason, ''), 200)));
  return pg_catalog.jsonb_build_object('status', 'lifted');
end $$;

revoke all on function api.guardian_can(text), api.guardian_status(), api.age_review_request(text, text), api.age_review_decide(uuid, boolean, text),
  api.guardian_link_create(), api.guardian_link_accept(text), api.guardian_settings_set(uuid, int, int, boolean, boolean, boolean),
  api.guardian_link_revoke(uuid, text), api.guardian_links(), api.restriction_set(uuid, text, text, int), api.restriction_lift(uuid, text) from public, anon;
grant execute on function api.guardian_can(text), api.guardian_status(), api.age_review_request(text, text), api.age_review_decide(uuid, boolean, text),
  api.guardian_link_create(), api.guardian_link_accept(text), api.guardian_settings_set(uuid, int, int, boolean, boolean, boolean),
  api.guardian_link_revoke(uuid, text), api.guardian_links(), api.restriction_set(uuid, text, text, int), api.restriction_lift(uuid, text) to authenticated;
