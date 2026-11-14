-- D-73 — Communauté et modération (migration additive : un schéma et des tables nouvelles, aucune donnée existante touchée).
-- Principes (OWASP ASVS 5 : contrôle d'accès côté serveur, validation des entrées, journalisation ; lints Supabase splinter) :
--   * Aucune écriture directe : les clients n'ont que SELECT sous RLS ; toute écriture passe par une fonction api.*
--     (security definer, search_path vide) qui contrôle l'identité, l'âge, le statut, les limites et le contenu.
--   * Âge : moins de 13 ans refusé ; 13-14 ans seulement avec le consentement parental déclaré (majorité numérique
--     française à 15 ans) ; seule la tranche d'âge est conservée, jamais la date de naissance.
--     Mineurs : profil jamais public, contenus « mature » invisibles, un adulte ne peut pas suivre un mineur.
--   * Blocage : réciproque pour la visibilité, supprime les abonnements dans les deux sens.
--   * Signalements : motifs fermés ; masquage automatique en attente d'examen à 3 signalements distincts, ou dès
--     le premier pour la sécurité des mineurs ; un signalement par personne et par cible tant qu'il est ouvert.
--   * Modération : réservée au rôle moderator ou admin (app.has_role), chaque action est journalisée (append-only).
--   * Limites de débit par utilisateur (publications, signalements, abonnements, réactions).
--   * Les prix, valeurs, emplacements et notes privées ne peuvent jamais être publiés (clés refusées).

create schema if not exists community;
revoke all on schema community from public, anon;
grant usage on schema community to authenticated;

create table community.members (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  handle           extensions.citext not null unique check (handle::text ~ '^[A-Za-z0-9_.-]{3,24}$'),
  display_name     text not null default '' check (char_length(display_name) <= 40),
  bio              text not null default '' check (char_length(bio) <= 160),
  age_band         text not null check (age_band in ('13-14', '15-17', '18+')),
  parental_consent boolean not null default false,
  visibility       text not null default 'private' check (visibility in ('public', 'followers', 'private')),
  status           text not null default 'active' check (status in ('active', 'suspended', 'banned')),
  suspended_until  timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (age_band <> '13-14' or parental_consent),
  check (age_band = '18+' or visibility <> 'public')
);

create table community.posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references community.members (user_id) on delete cascade,
  kind        text not null check (kind in ('planche', 'story')),
  body        text not null default '' check (char_length(body) <= 2000),
  payload     jsonb not null default '{}'::jsonb check (pg_catalog.octet_length(payload::text) <= 20000),
  visibility  text not null default 'followers' check (visibility in ('public', 'followers', 'private')),
  mature      boolean not null default false,
  spoiler     boolean not null default false,
  status      text not null default 'visible' check (status in ('visible', 'hidden', 'removed', 'deleted')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index posts_author_idx on community.posts (author_id, created_at desc);

create table community.follows (
  follower_id uuid not null references community.members (user_id) on delete cascade,
  followee_id uuid not null references community.members (user_id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on community.follows (followee_id);

create table community.blocks (
  blocker_id uuid not null references community.members (user_id) on delete cascade,
  blocked_id uuid not null references community.members (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on community.blocks (blocked_id);

create table community.reactions (
  post_id    uuid not null references community.posts (id) on delete cascade,
  user_id    uuid not null references community.members (user_id) on delete cascade,
  kind       text not null check (kind in ('pow', 'wow', 'bam', 'zap', 'kapow')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index reactions_user_idx on community.reactions (user_id);

create table community.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid references community.members (user_id) on delete set null,
  target_kind text not null check (target_kind in ('post', 'member')),
  target_id   uuid not null,
  reason      text not null check (reason in ('spam', 'harassment', 'hate', 'sexual', 'minor_safety', 'violence', 'self_harm', 'spoiler', 'copyright', 'impersonation', 'other')),
  details     text not null default '' check (char_length(details) <= 500),
  status      text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index reports_one_open_idx on community.reports (reporter_id, target_kind, target_id) where status = 'open';
create index reports_target_idx on community.reports (target_kind, target_id, status);

create table community.moderation_log (
  id           bigint generated always as identity primary key,
  moderator_id uuid references auth.users (id) on delete set null,
  target_kind  text not null check (target_kind in ('post', 'member')),
  target_id    uuid not null,
  action       text not null check (action in ('auto_hide', 'hide', 'restore', 'remove', 'warn', 'suspend', 'unsuspend', 'ban', 'unban', 'dismiss')),
  reason       text not null default '' check (char_length(reason) <= 500),
  report_id    uuid,
  created_at   timestamptz not null default now()
);
create index moderation_log_target_idx on community.moderation_log (target_kind, target_id);

create table community.rate_events (
  user_id uuid not null references auth.users (id) on delete cascade,
  action  text not null,
  at      timestamptz not null default now()
);
create index rate_events_idx on community.rate_events (user_id, action, at desc);

create table community.limits (
  action     text primary key,
  max_count  int not null check (max_count > 0),
  per_seconds int not null check (per_seconds > 0)
);
insert into community.limits (action, max_count, per_seconds) values
  ('post', 20, 3600), ('report', 30, 86400), ('follow', 200, 3600), ('react', 600, 3600), ('block', 100, 86400);

-- RLS partout ; aucun privilège d'écriture pour les clients.
alter table community.members enable row level security;
alter table community.posts enable row level security;
alter table community.follows enable row level security;
alter table community.blocks enable row level security;
alter table community.reactions enable row level security;
alter table community.reports enable row level security;
alter table community.moderation_log enable row level security;
alter table community.rate_events enable row level security;
alter table community.limits enable row level security;
revoke all on all tables in schema community from public, anon, authenticated;
grant select on community.members, community.posts, community.follows, community.blocks, community.reactions, community.reports to authenticated;

-- Fonctions d'aide (security definer pour lire sans boucle de RLS ; jamais exposées aux clients)
create function community.is_adult(p_user uuid) returns boolean
language sql security definer set search_path = '' stable
as $$ select exists (select 1 from community.members m where m.user_id = p_user and m.age_band = '18+'); $$;
create function community.blocked_between(a uuid, b uuid) returns boolean
language sql security definer set search_path = '' stable
as $$ select exists (select 1 from community.blocks x where (x.blocker_id = a and x.blocked_id = b) or (x.blocker_id = b and x.blocked_id = a)); $$;
create function community.is_staff() returns boolean
language sql security definer set search_path = '' stable
as $$ select app.has_role('moderator') or app.has_role('admin'); $$;
create function community.member_active(p_user uuid) returns boolean
language sql security definer set search_path = '' stable
as $$
  select exists (select 1 from community.members m where m.user_id = p_user
    and (m.status = 'active' or (m.status = 'suspended' and m.suspended_until is not null and m.suspended_until <= now())));
$$;
-- Un membre voit les autres membres (pseudo, nom, bio) sauf blocage ou bannissement ; un adulte ne voit jamais un mineur.
create function community.can_see_member(p_user uuid) returns boolean
language sql security definer set search_path = '' stable
as $$
  select p_user = auth.uid() or community.is_staff() or (
    exists (select 1 from community.members me where me.user_id = auth.uid())
    and exists (select 1 from community.members m where m.user_id = p_user and m.status <> 'banned')
    and not community.blocked_between(auth.uid(), p_user)
    and (community.is_adult(p_user) or not community.is_adult(auth.uid()))
  );
$$;
create function community.can_see_post(p_post uuid) returns boolean
language sql security definer set search_path = '' stable
as $$
  select exists (
    select 1 from community.posts p join community.members a on a.user_id = p.author_id
    where p.id = p_post and (
      p.author_id = auth.uid()
      or community.is_staff()
      or (p.status = 'visible' and community.member_active(a.user_id)
          and (community.is_adult(a.user_id) or not community.is_adult(auth.uid()))
          and exists (select 1 from community.members me where me.user_id = auth.uid())
          and not community.blocked_between(auth.uid(), p.author_id)
          and (not p.mature or community.is_adult(auth.uid()))
          and (p.visibility = 'public'
               or (p.visibility = 'followers' and exists (select 1 from community.follows f where f.follower_id = auth.uid() and f.followee_id = p.author_id))))
    )
  );
$$;
create function community.rate_check(p_action text) returns void
language plpgsql security definer set search_path = ''
as $$
declare lim record; n int;
begin
  select * into lim from community.limits where action = p_action;
  if not found then return; end if;
  select count(*) into n from community.rate_events e where e.user_id = auth.uid() and e.action = p_action and e.at > now() - pg_catalog.make_interval(secs => lim.per_seconds);
  if n >= lim.max_count then raise exception 'rate_limited' using errcode = '53400'; end if;
  insert into community.rate_events (user_id, action) values (auth.uid(), p_action);
end;
$$;
-- Contenu publiable : aucune donnée privée de la collection (prix, valeur, emplacement, notes, achat)
create function community.payload_ok(p jsonb) returns boolean
language sql immutable set search_path = ''
as $$
  select pg_catalog.jsonb_typeof(p) = 'object' and not (p::text ~* '"(price|purchaseprice|purchase_price|estvalue|est_value|value|valuehistory|location|box|notes|purchasedate|purchase_date|paid)"\s*:');
$$;
revoke all on function community.member_active(uuid), community.is_adult(uuid), community.blocked_between(uuid, uuid), community.is_staff(),
  community.can_see_member(uuid), community.can_see_post(uuid), community.rate_check(text), community.payload_ok(jsonb) from public, anon;
grant execute on function community.member_active(uuid), community.is_adult(uuid), community.blocked_between(uuid, uuid), community.is_staff(),
  community.can_see_member(uuid), community.can_see_post(uuid) to authenticated;

-- Politiques de lecture
create policy members_select on community.members for select to authenticated using (community.can_see_member(user_id));
create policy posts_select on community.posts for select to authenticated using (community.can_see_post(id));
create policy follows_select on community.follows for select to authenticated
  using ((select auth.uid()) in (follower_id, followee_id) or community.is_staff());
create policy blocks_select on community.blocks for select to authenticated using ((select auth.uid()) = blocker_id);
create policy reactions_select on community.reactions for select to authenticated using (community.can_see_post(post_id));
create policy reports_select on community.reports for select to authenticated using ((select auth.uid()) = reporter_id or community.is_staff());

-- ---------- API : adhésion et profil public
create function api.community_join(p_handle text, p_birth_year int, p_parental_consent boolean default false) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare age int; band text;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_handle is null or p_handle !~ '^[A-Za-z0-9_.-]{3,24}$' then raise exception 'invalid_handle' using errcode = '22023'; end if;
  if p_birth_year is null or p_birth_year < 1900 or p_birth_year > extract(year from now())::int then raise exception 'invalid_age' using errcode = '22023'; end if;
  -- Âge minimal possible pour l'année donnée (prudent : on suppose l'anniversaire pas encore passé)
  age := extract(year from now())::int - p_birth_year - 1;
  if age < 13 then raise exception 'too_young' using errcode = '22023'; end if;
  band := case when age < 15 then '13-14' when age < 18 then '15-17' else '18+' end;
  if band = '13-14' and not coalesce(p_parental_consent, false) then raise exception 'parental_consent_required' using errcode = '22023'; end if;
  if exists (select 1 from community.members where user_id = auth.uid()) then raise exception 'already_member' using errcode = '23505'; end if;
  if exists (select 1 from community.members where pg_catalog.lower(handle::text) = pg_catalog.lower(p_handle)) then raise exception 'handle_taken' using errcode = '23505'; end if;
  begin
    insert into community.members (user_id, handle, age_band, parental_consent) values (auth.uid(), p_handle, band, band = '13-14');
  exception when unique_violation then raise exception 'handle_taken' using errcode = '23505';
  end;
  return pg_catalog.jsonb_build_object('status', 'joined', 'age_band', band, 'visibility', 'private');
end;
$$;

create function api.community_update_profile(p_display_name text, p_bio text, p_visibility text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare band text;
begin
  select age_band into band from community.members where user_id = auth.uid();
  if not found then raise exception 'not_member' using errcode = '42501'; end if;
  if p_visibility not in ('public', 'followers', 'private') then raise exception 'invalid_visibility' using errcode = '22023'; end if;
  if band <> '18+' and p_visibility = 'public' then raise exception 'minor_profile_not_public' using errcode = '42501'; end if;
  update community.members set display_name = pg_catalog.left(pg_catalog.regexp_replace(coalesce(p_display_name, ''), '[[:cntrl:]<>]', '', 'g'), 40),
    bio = pg_catalog.left(pg_catalog.regexp_replace(coalesce(p_bio, ''), '[[:cntrl:]<>]', '', 'g'), 160), visibility = p_visibility, updated_at = now()
  where user_id = auth.uid();
  return pg_catalog.jsonb_build_object('status', 'updated');
end;
$$;

-- ---------- API : publications
create function api.post_create(p_kind text, p_body text, p_payload jsonb, p_visibility text, p_mature boolean default false, p_spoiler boolean default false) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare pid uuid;
begin
  if not community.member_active(auth.uid()) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_kind not in ('planche', 'story') or p_visibility not in ('public', 'followers', 'private') then raise exception 'invalid_post' using errcode = '22023'; end if;
  if char_length(coalesce(p_body, '')) > 2000 then raise exception 'too_long' using errcode = '22001'; end if;
  if not community.payload_ok(coalesce(p_payload, '{}'::jsonb)) then raise exception 'private_data_refused' using errcode = '22023'; end if;
  if coalesce(p_mature, false) and not community.is_adult(auth.uid()) then raise exception 'minor_mature_refused' using errcode = '42501'; end if;
  perform community.rate_check('post');
  insert into community.posts (author_id, kind, body, payload, visibility, mature, spoiler)
  values (auth.uid(), p_kind, pg_catalog.regexp_replace(coalesce(p_body, ''), '[\x00-\x08\x0B\x0C\x0E-\x1F]', '', 'g'), coalesce(p_payload, '{}'::jsonb), p_visibility, coalesce(p_mature, false), coalesce(p_spoiler, false))
  returning id into pid;
  return pid;
end;
$$;

create function api.post_delete(p_post uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare c int;
begin
  update community.posts set status = 'deleted', body = '', payload = '{}'::jsonb, updated_at = now() where id = p_post and author_id = auth.uid() and status <> 'deleted';
  get diagnostics c = row_count;
  return pg_catalog.jsonb_build_object('status', case when c > 0 then 'deleted' else 'unchanged' end);
end;
$$;

-- ---------- API : abonnements, blocages, réactions
create function api.follow(p_user uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not community.member_active(auth.uid()) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_user = auth.uid() or not exists (select 1 from community.members where user_id = p_user and status <> 'banned') then raise exception 'invalid_target' using errcode = '22023'; end if;
  if community.blocked_between(auth.uid(), p_user) then raise exception 'blocked' using errcode = '42501'; end if;
  if community.is_adult(auth.uid()) and not community.is_adult(p_user) then raise exception 'minor_protected' using errcode = '42501'; end if;
  perform community.rate_check('follow');
  insert into community.follows (follower_id, followee_id) values (auth.uid(), p_user) on conflict do nothing;
  return pg_catalog.jsonb_build_object('status', 'following');
end;
$$;
create function api.unfollow(p_user uuid) returns jsonb
language sql security definer set search_path = ''
as $$
  with d as (delete from community.follows where follower_id = auth.uid() and followee_id = p_user returning 1)
  select pg_catalog.jsonb_build_object('status', case when exists (select 1 from d) then 'unfollowed' else 'unchanged' end);
$$;
create function api.block(p_user uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from community.members where user_id = auth.uid()) then raise exception 'not_member' using errcode = '42501'; end if;
  if p_user = auth.uid() or not exists (select 1 from community.members where user_id = p_user) then raise exception 'invalid_target' using errcode = '22023'; end if;
  perform community.rate_check('block');
  insert into community.blocks (blocker_id, blocked_id) values (auth.uid(), p_user) on conflict do nothing;
  delete from community.follows where (follower_id = auth.uid() and followee_id = p_user) or (follower_id = p_user and followee_id = auth.uid());
  delete from community.reactions r using community.posts p where r.post_id = p.id and ((r.user_id = p_user and p.author_id = auth.uid()) or (r.user_id = auth.uid() and p.author_id = p_user));
  return pg_catalog.jsonb_build_object('status', 'blocked');
end;
$$;
create function api.unblock(p_user uuid) returns jsonb
language sql security definer set search_path = ''
as $$
  with d as (delete from community.blocks where blocker_id = auth.uid() and blocked_id = p_user returning 1)
  select pg_catalog.jsonb_build_object('status', case when exists (select 1 from d) then 'unblocked' else 'unchanged' end);
$$;
create function api.react(p_post uuid, p_kind text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not community.member_active(auth.uid()) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_kind not in ('pow', 'wow', 'bam', 'zap', 'kapow') then raise exception 'invalid_reaction' using errcode = '22023'; end if;
  if not community.can_see_post(p_post) then raise exception 'not_found' using errcode = '42704'; end if;
  perform community.rate_check('react');
  insert into community.reactions (post_id, user_id, kind) values (p_post, auth.uid(), p_kind)
  on conflict (post_id, user_id) do update set kind = excluded.kind, created_at = now();
  return pg_catalog.jsonb_build_object('status', 'reacted');
end;
$$;
create function api.unreact(p_post uuid) returns jsonb
language sql security definer set search_path = ''
as $$
  with d as (delete from community.reactions where post_id = p_post and user_id = auth.uid() returning 1)
  select pg_catalog.jsonb_build_object('status', case when exists (select 1 from d) then 'removed' else 'unchanged' end);
$$;

-- ---------- API : signalements (masquage automatique en attente d'examen)
create function api.report(p_target_kind text, p_target uuid, p_reason text, p_details text default '') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare n int; rid uuid; hidden boolean := false;
begin
  if not exists (select 1 from community.members where user_id = auth.uid()) then raise exception 'not_member' using errcode = '42501'; end if;
  if p_target_kind = 'post' then
    if not community.can_see_post(p_target) then raise exception 'not_found' using errcode = '42704'; end if;
  elsif p_target_kind = 'member' then
    if p_target = auth.uid() or not exists (select 1 from community.members where user_id = p_target) then raise exception 'invalid_target' using errcode = '22023'; end if;
  else raise exception 'invalid_target' using errcode = '22023'; end if;
  if p_reason not in ('spam', 'harassment', 'hate', 'sexual', 'minor_safety', 'violence', 'self_harm', 'spoiler', 'copyright', 'impersonation', 'other') then raise exception 'invalid_reason' using errcode = '22023'; end if;
  if exists (select 1 from community.reports where reporter_id = auth.uid() and target_kind = p_target_kind and target_id = p_target and status = 'open') then
    return pg_catalog.jsonb_build_object('status', 'already_reported');
  end if;
  perform community.rate_check('report');
  insert into community.reports (reporter_id, target_kind, target_id, reason, details)
  values (auth.uid(), p_target_kind, p_target, p_reason, pg_catalog.left(pg_catalog.regexp_replace(coalesce(p_details, ''), '[[:cntrl:]]', ' ', 'g'), 500)) returning id into rid;
  if p_target_kind = 'post' then
    select count(distinct reporter_id) into n from community.reports where target_kind = 'post' and target_id = p_target and status = 'open';
    if n >= 3 or p_reason = 'minor_safety' then
      update community.posts set status = 'hidden', updated_at = now() where id = p_target and status = 'visible';
      if found then
        hidden := true;
        insert into community.moderation_log (moderator_id, target_kind, target_id, action, reason, report_id)
        values (null, 'post', p_target, 'auto_hide', case when p_reason = 'minor_safety' then 'Sécurité des mineurs : masquage immédiat' else 'Trois signalements distincts' end, rid);
      end if;
    end if;
  end if;
  return pg_catalog.jsonb_build_object('status', 'reported', 'id', rid, 'hidden', hidden);
end;
$$;

-- ---------- API : modération (rôle moderator ou admin)
create function api.mod_queue(p_limit int default 50) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not community.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select pg_catalog.jsonb_agg(x order by x.priority desc, x.first_at) from (
    select r.target_kind, r.target_id, count(*)::int as reports, pg_catalog.array_agg(distinct r.reason) as reasons,
      min(r.created_at) as first_at, max(case when r.reason in ('minor_safety', 'self_harm') then 2 when r.reason in ('hate', 'harassment', 'sexual', 'violence') then 1 else 0 end) as priority
    from community.reports r where r.status = 'open' group by r.target_kind, r.target_id
    limit greatest(1, least(coalesce(p_limit, 50), 200))) x), '[]'::jsonb);
end;
$$;
create function api.mod_act(p_target_kind text, p_target uuid, p_action text, p_reason text, p_days int default 7) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not community.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  if coalesce(pg_catalog.btrim(p_reason), '') = '' then raise exception 'reason_required' using errcode = '22023'; end if;
  if p_target_kind = 'post' and p_action in ('hide', 'restore', 'remove', 'dismiss') then
    update community.posts set status = case p_action when 'hide' then 'hidden' when 'remove' then 'removed' when 'restore' then 'visible' else status end, updated_at = now() where id = p_target;
  elsif p_target_kind = 'member' and p_action in ('warn', 'suspend', 'unsuspend', 'ban', 'unban', 'dismiss') then
    if p_target = auth.uid() then raise exception 'self_moderation_refused' using errcode = '42501'; end if;
    update community.members set
      status = case p_action when 'suspend' then 'suspended' when 'ban' then 'banned' when 'unsuspend' then 'active' when 'unban' then 'active' else status end,
      suspended_until = case p_action when 'suspend' then now() + pg_catalog.make_interval(days => greatest(1, least(coalesce(p_days, 7), 365))) when 'unsuspend' then null when 'unban' then null else suspended_until end,
      updated_at = now()
    where user_id = p_target;
  else raise exception 'invalid_action' using errcode = '22023'; end if;
  if not found and p_action <> 'warn' then raise exception 'not_found' using errcode = '42704'; end if;
  update community.reports set status = case when p_action in ('dismiss', 'restore', 'unban', 'unsuspend') then 'dismissed' else 'actioned' end, resolved_at = now()
  where target_kind = p_target_kind and target_id = p_target and status = 'open';
  insert into community.moderation_log (moderator_id, target_kind, target_id, action, reason) values (auth.uid(), p_target_kind, p_target, p_action, pg_catalog.left(p_reason, 500));
  return pg_catalog.jsonb_build_object('status', 'done', 'action', p_action);
end;
$$;
create function api.mod_log(p_target uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not community.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(l) order by l.id) from community.moderation_log l where l.target_id = p_target), '[]'::jsonb);
end;
$$;

-- Droits : rien pour public et anon ; exécution des API pour les utilisateurs connectés seulement
revoke all on function api.community_join(text, int, boolean), api.community_update_profile(text, text, text),
  api.post_create(text, text, jsonb, text, boolean, boolean), api.post_delete(uuid), api.follow(uuid), api.unfollow(uuid),
  api.block(uuid), api.unblock(uuid), api.react(uuid, text), api.unreact(uuid), api.report(text, uuid, text, text),
  api.mod_queue(int), api.mod_act(text, uuid, text, text, int), api.mod_log(uuid) from public, anon;
grant execute on function api.community_join(text, int, boolean), api.community_update_profile(text, text, text),
  api.post_create(text, text, jsonb, text, boolean, boolean), api.post_delete(uuid), api.follow(uuid), api.unfollow(uuid),
  api.block(uuid), api.unblock(uuid), api.react(uuid, text), api.unreact(uuid), api.report(text, uuid, text, text),
  api.mod_queue(int), api.mod_act(text, uuid, text, text, int), api.mod_log(uuid) to authenticated;
