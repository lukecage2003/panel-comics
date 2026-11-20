-- D-97 — Réseau social en ligne, lot S8 (migration additive : colonnes, tables et fonctions nouvelles ; aucune donnée
-- existante modifiée ni supprimée). Mêmes principes que la migration 13 : lecture seule sous RLS pour les clients,
-- toute écriture par une fonction api.* (security definer, search_path vide), âge, blocages, limites et journal.
--   * Pensées (D-96) : publications de type « note » (pensée, théorie, question), 500 caractères, mots-dièse indexés,
--     verdict des théories donné par leur auteur seulement. Les images restent sur l'appareil (D-04 : stockage à venir).
--   * Tendances : mots-dièse des publications visibles par l'appelant, sept jours, pondérés par la fraîcheur (48 h).
--   * J'aime : réaction « like » ; chaque membre choisit la forme de son J'aime (dessins de Panel, aucun logo).
--   * Directs : salons (format, camps du duel), chat (200 caractères, 30 messages par minute), votes du duel
--     (un par membre, jamais lisibles individuellement par les autres : seul le décompte est rendu).
--     Voix seule : aucune vidéo ; le transport audio n'est pas dans la base (serveur à choisir, accord requis).
--   * Signalements et modération étendus aux messages et aux salons de direct.

-- ---------- Publications : type « note »
alter table community.posts drop constraint if exists posts_kind_check;
alter table community.posts add constraint posts_kind_check check (kind in ('planche', 'story', 'note'));

create table community.post_tags (
  post_id uuid not null references community.posts (id) on delete cascade,
  tag     extensions.citext not null check (char_length(tag::text) between 2 and 30),
  primary key (post_id, tag)
);
create index post_tags_tag_idx on community.post_tags (tag);

-- ---------- J'aime : réaction « like » et forme choisie
alter table community.reactions drop constraint if exists reactions_kind_check;
alter table community.reactions add constraint reactions_kind_check check (kind in ('like', 'pow', 'wow', 'bam', 'zap', 'kapow'));
alter table community.members add column like_icon text not null default 'heart'
  check (like_icon in ('heart', 'claws', 'bolt', 'web', 'hammer', 'wings', 'flame', 'cosmic', 'ring', 'mask', 'shield', 'skull'));
-- Même fonction qu'en migration 13 (même signature, droits conservés), « like » en plus
create or replace function api.react(p_post uuid, p_kind text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not community.member_active(auth.uid()) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_kind not in ('like', 'pow', 'wow', 'bam', 'zap', 'kapow') then raise exception 'invalid_reaction' using errcode = '22023'; end if;
  if not community.can_see_post(p_post) then raise exception 'not_found' using errcode = '42704'; end if;
  perform community.rate_check('react');
  insert into community.reactions (post_id, user_id, kind) values (p_post, auth.uid(), p_kind)
  on conflict (post_id, user_id) do update set kind = excluded.kind, created_at = now();
  return pg_catalog.jsonb_build_object('status', 'reacted');
end;
$$;

-- ---------- Directs
create table community.live_rooms (
  id          uuid primary key default gen_random_uuid(),
  host_id     uuid not null references community.members (user_id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 80),
  format      text not null check (format in ('wednesday', 'review', 'debate', 'qa', 'duel')),
  side_a      text not null default '' check (char_length(side_a) <= 40),
  side_b      text not null default '' check (char_length(side_b) <= 40),
  visibility  text not null default 'followers' check (visibility in ('public', 'followers')),
  status      text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended', 'hidden', 'removed')),
  starts_at   timestamptz,
  started_at  timestamptz,
  ended_at    timestamptz,
  created_at  timestamptz not null default now(),
  check (format <> 'duel' or (side_a <> '' and side_b <> ''))
);
create index live_rooms_host_idx on community.live_rooms (host_id, created_at desc);
create index live_rooms_status_idx on community.live_rooms (status, starts_at);

create table community.live_messages (
  id         bigint generated always as identity primary key,
  room_id    uuid not null references community.live_rooms (id) on delete cascade,
  author_id  uuid not null references community.members (user_id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 200),
  status     text not null default 'visible' check (status in ('visible', 'hidden', 'removed', 'deleted')),
  created_at timestamptz not null default now()
);
create index live_messages_room_idx on community.live_messages (room_id, id);

create table community.live_votes (
  room_id    uuid not null references community.live_rooms (id) on delete cascade,
  user_id    uuid not null references community.members (user_id) on delete cascade,
  side       smallint not null check (side in (0, 1)),
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- Signalements et journal : nouvelles cibles
alter table community.reports drop constraint if exists reports_target_kind_check;
alter table community.reports add constraint reports_target_kind_check check (target_kind in ('post', 'member', 'live_room', 'live_message'));
alter table community.moderation_log drop constraint if exists moderation_log_target_kind_check;
alter table community.moderation_log add constraint moderation_log_target_kind_check check (target_kind in ('post', 'member', 'live_room', 'live_message'));
-- Les messages ont un identifiant numérique : il est rangé dans un uuid déterministe pour les signalements
create function community.msg_uuid(p_id bigint) returns uuid
language sql immutable set search_path = ''
as $$ select ('00000000-0000-4000-8000-' || pg_catalog.lpad(pg_catalog.to_hex(p_id), 12, '0'))::uuid; $$;

insert into community.limits (action, max_count, per_seconds) values ('chat', 30, 60), ('live', 10, 86400), ('vote', 120, 3600)
on conflict (action) do nothing;

alter table community.post_tags enable row level security;
alter table community.live_rooms enable row level security;
alter table community.live_messages enable row level security;
alter table community.live_votes enable row level security;
revoke all on community.post_tags, community.live_rooms, community.live_messages, community.live_votes from public, anon, authenticated;
grant select on community.post_tags, community.live_rooms, community.live_messages, community.live_votes to authenticated;

-- Visibilité d'un salon : mêmes règles qu'une publication (âge, blocage, abonnement pour « followers »)
create function community.can_see_room(p_room uuid) returns boolean
language sql security definer set search_path = '' stable
as $$
  select exists (
    select 1 from community.live_rooms r
    where r.id = p_room and (
      r.host_id = auth.uid()
      or community.is_staff()
      or (r.status in ('scheduled', 'live', 'ended') and community.member_active(r.host_id)
          and exists (select 1 from community.members me where me.user_id = auth.uid())
          and (community.is_adult(r.host_id) or not community.is_adult(auth.uid()))
          and not community.blocked_between(auth.uid(), r.host_id)
          and (r.visibility = 'public'
               or exists (select 1 from community.follows f where f.follower_id = auth.uid() and f.followee_id = r.host_id)))
    )
  );
$$;
-- Un message se voit si le salon se voit, s'il est visible, et si son auteur est visible pour l'appelant
create function community.can_see_message(p_room uuid, p_author uuid, p_status text) returns boolean
language sql security definer set search_path = '' stable
as $$
  select community.is_staff() or p_author = auth.uid() or (
    p_status = 'visible' and community.can_see_room(p_room) and community.can_see_member(p_author)
  );
$$;
revoke all on function community.can_see_room(uuid), community.can_see_message(uuid, uuid, text), community.msg_uuid(bigint) from public, anon;
grant execute on function community.can_see_room(uuid), community.can_see_message(uuid, uuid, text) to authenticated;

create policy post_tags_select on community.post_tags for select to authenticated using (community.can_see_post(post_id));
create policy live_rooms_select on community.live_rooms for select to authenticated using (community.can_see_room(id));
create policy live_messages_select on community.live_messages for select to authenticated using (community.can_see_message(room_id, author_id, status));
-- Votes : chacun ne lit que le sien ; le décompte passe par api.live_tally
create policy live_votes_select on community.live_votes for select to authenticated using ((select auth.uid()) = user_id);

-- ---------- API : pensées
create function api.note_create(p_note_kind text, p_body text, p_tags text[], p_issue jsonb, p_visibility text, p_spoiler boolean default false) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare pid uuid; b text; t text; n int := 0; pay jsonb;
begin
  if not community.member_active(auth.uid()) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_note_kind not in ('thought', 'theory', 'question') or p_visibility not in ('public', 'followers', 'private') then raise exception 'invalid_post' using errcode = '22023'; end if;
  b := pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_body, ''), '[\x00-\x08\x0B\x0C\x0E-\x1F]', '', 'g'));
  if b = '' then raise exception 'empty' using errcode = '22023'; end if;
  if char_length(b) > 500 then raise exception 'too_long' using errcode = '22001'; end if;
  if b ~ '<[A-Za-z!/]' then raise exception 'markup_refused' using errcode = '22023'; end if;
  pay := pg_catalog.jsonb_build_object('note', p_note_kind, 'verdict', case when p_note_kind = 'theory' then 'open' else '' end);
  if p_issue is not null and pg_catalog.jsonb_typeof(p_issue) = 'object' and coalesce(p_issue ->> 'series', '') <> '' then
    pay := pay || pg_catalog.jsonb_build_object('issue', pg_catalog.jsonb_build_object(
      'series', pg_catalog.left(p_issue ->> 'series', 120), 'issue', pg_catalog.left(coalesce(p_issue ->> 'issue', ''), 20), 'publisher', pg_catalog.left(coalesce(p_issue ->> 'publisher', ''), 100)));
  end if;
  perform community.rate_check('post');
  insert into community.posts (author_id, kind, body, payload, visibility, spoiler)
  values (auth.uid(), 'note', b, pay, p_visibility, coalesce(p_spoiler, false)) returning id into pid;
  -- Mots-dièse : seulement ceux réellement écrits dans le texte, dix au plus
  foreach t in array coalesce(p_tags, '{}'::text[]) loop
    exit when n >= 10;
    t := pg_catalog.btrim(t);
    if char_length(t) between 2 and 30 and t !~ '[[:space:]#<>@/\\]' and pg_catalog.strpos(pg_catalog.lower(b), '#' || pg_catalog.lower(t)) > 0 then
      insert into community.post_tags (post_id, tag) values (pid, t) on conflict do nothing;
      if found then n := n + 1; end if;
    end if;
  end loop;
  return pid;
end;
$$;

create function api.note_verdict(p_post uuid, p_verdict text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare c int;
begin
  if p_verdict not in ('open', 'confirmed', 'busted') then raise exception 'invalid_verdict' using errcode = '22023'; end if;
  update community.posts set payload = payload || pg_catalog.jsonb_build_object('verdict', p_verdict), updated_at = now()
  where id = p_post and author_id = auth.uid() and kind = 'note' and payload ->> 'note' = 'theory' and status <> 'deleted';
  get diagnostics c = row_count;
  if c = 0 then raise exception 'not_found' using errcode = '42704'; end if;
  return pg_catalog.jsonb_build_object('status', 'updated', 'verdict', p_verdict);
end;
$$;

create function api.trending_tags(p_limit int default 10) returns jsonb
language plpgsql security definer set search_path = '' stable
as $$
begin
  if not exists (select 1 from community.members where user_id = auth.uid()) then raise exception 'not_member' using errcode = '42501'; end if;
  return coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('tag', x.tag, 'score', pg_catalog.round(x.score::numeric, 2)) order by x.score desc, x.tag) from (
    select min(t.tag::text) as tag, sum(pg_catalog.power(0.5, extract(epoch from (now() - p.created_at)) / 3600.0 / 48.0)) as score
    from community.post_tags t join community.posts p on p.id = t.post_id
    where p.created_at > now() - interval '7 days' and community.can_see_post(p.id)
    group by pg_catalog.lower(t.tag::text)
    order by score desc limit greatest(1, least(coalesce(p_limit, 10), 50))) x), '[]'::jsonb);
end;
$$;

create function api.set_like_icon(p_icon text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if p_icon not in ('heart', 'claws', 'bolt', 'web', 'hammer', 'wings', 'flame', 'cosmic', 'ring', 'mask', 'shield', 'skull') then raise exception 'invalid_icon' using errcode = '22023'; end if;
  update community.members set like_icon = p_icon, updated_at = now() where user_id = auth.uid();
  if not found then raise exception 'not_member' using errcode = '42501'; end if;
  return pg_catalog.jsonb_build_object('status', 'updated', 'like_icon', p_icon);
end;
$$;

-- ---------- API : directs
create function api.live_create(p_title text, p_format text, p_side_a text, p_side_b text, p_visibility text, p_starts_at timestamptz default null) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare rid uuid; ti text; a text; b text;
begin
  if not community.member_active(auth.uid()) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_format not in ('wednesday', 'review', 'debate', 'qa', 'duel') or p_visibility not in ('public', 'followers') then raise exception 'invalid_room' using errcode = '22023'; end if;
  ti := pg_catalog.left(pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_title, ''), '[[:cntrl:]<>]', '', 'g')), 80);
  a := pg_catalog.left(pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_side_a, ''), '[[:cntrl:]<>]', '', 'g')), 40);
  b := pg_catalog.left(pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_side_b, ''), '[[:cntrl:]<>]', '', 'g')), 40);
  if ti = '' then raise exception 'title_required' using errcode = '22023'; end if;
  if p_format = 'duel' and (a = '' or b = '') then raise exception 'sides_required' using errcode = '22023'; end if;
  if p_format <> 'duel' then a := ''; b := ''; end if;
  perform community.rate_check('live');
  insert into community.live_rooms (host_id, title, format, side_a, side_b, visibility, starts_at)
  values (auth.uid(), ti, p_format, a, b, p_visibility, p_starts_at) returning id into rid;
  return rid;
end;
$$;

create function api.live_set_status(p_room uuid, p_status text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare c int;
begin
  if p_status not in ('live', 'ended') then raise exception 'invalid_status' using errcode = '22023'; end if;
  if p_status = 'live' and not community.member_active(auth.uid()) then raise exception 'not_allowed' using errcode = '42501'; end if;
  update community.live_rooms set status = p_status,
    started_at = case when p_status = 'live' then coalesce(started_at, now()) else started_at end,
    ended_at = case when p_status = 'ended' then now() else ended_at end
  where id = p_room and host_id = auth.uid() and status in ('scheduled', 'live') and not (status = 'live' and p_status = 'live');
  get diagnostics c = row_count;
  if c = 0 then raise exception 'not_found' using errcode = '42704'; end if;
  return pg_catalog.jsonb_build_object('status', p_status);
end;
$$;

create function api.live_say(p_room uuid, p_body text) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare b text; mid bigint;
begin
  if not community.member_active(auth.uid()) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if not community.can_see_room(p_room) or not exists (select 1 from community.live_rooms where id = p_room and status = 'live') then raise exception 'not_live' using errcode = '42704'; end if;
  b := pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_body, ''), '[[:cntrl:]]', ' ', 'g'));
  if b = '' then raise exception 'empty' using errcode = '22023'; end if;
  if char_length(b) > 200 then raise exception 'too_long' using errcode = '22001'; end if;
  if b ~ '<[A-Za-z!/]' then raise exception 'markup_refused' using errcode = '22023'; end if;
  perform community.rate_check('chat');
  insert into community.live_messages (room_id, author_id, body) values (p_room, auth.uid(), b) returning id into mid;
  return mid;
end;
$$;

-- Retirer un message : son auteur, l'hôte du salon ou la modération (journalisé hors auteur)
create function api.live_unsay(p_message bigint, p_reason text default '') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare m record; host uuid;
begin
  select * into m from community.live_messages where id = p_message;
  if not found then raise exception 'not_found' using errcode = '42704'; end if;
  select host_id into host from community.live_rooms where id = m.room_id;
  if m.author_id = auth.uid() then
    update community.live_messages set status = 'deleted', body = '–' where id = p_message;
  elsif host = auth.uid() or community.is_staff() then
    update community.live_messages set status = 'removed' where id = p_message;
    insert into community.moderation_log (moderator_id, target_kind, target_id, action, reason)
    values (auth.uid(), 'live_message', community.msg_uuid(p_message), 'remove', pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p_reason), ''), case when host = auth.uid() then 'Retiré par l''hôte' else 'Modération' end), 500));
  else raise exception 'forbidden' using errcode = '42501';
  end if;
  return pg_catalog.jsonb_build_object('status', 'removed');
end;
$$;

create function api.live_vote(p_room uuid, p_side int) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not community.member_active(auth.uid()) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_side not in (0, 1) then raise exception 'invalid_side' using errcode = '22023'; end if;
  if not community.can_see_room(p_room) or not exists (select 1 from community.live_rooms where id = p_room and format = 'duel' and status = 'live') then raise exception 'not_live' using errcode = '42704'; end if;
  perform community.rate_check('vote');
  insert into community.live_votes (room_id, user_id, side) values (p_room, auth.uid(), p_side)
  on conflict (room_id, user_id) do update set side = excluded.side, created_at = now();
  return pg_catalog.jsonb_build_object('status', 'voted', 'side', p_side);
end;
$$;

create function api.live_tally(p_room uuid) returns jsonb
language plpgsql security definer set search_path = '' stable
as $$
begin
  if not community.can_see_room(p_room) then raise exception 'not_found' using errcode = '42704'; end if;
  return (select pg_catalog.jsonb_build_object('a', count(*) filter (where side = 0), 'b', count(*) filter (where side = 1))
          from community.live_votes v where v.room_id = p_room and not community.blocked_between(auth.uid(), v.user_id));
end;
$$;

-- Signalement d'un salon ou d'un message de direct (masquage automatique comme pour les publications)
create function api.report_live(p_target_kind text, p_room uuid, p_message bigint, p_reason text, p_details text default '') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare tid uuid; n int; rid uuid; hidden boolean := false; m record;
begin
  if not exists (select 1 from community.members where user_id = auth.uid()) then raise exception 'not_member' using errcode = '42501'; end if;
  if p_reason not in ('spam', 'harassment', 'hate', 'sexual', 'minor_safety', 'violence', 'self_harm', 'spoiler', 'copyright', 'impersonation', 'other') then raise exception 'invalid_reason' using errcode = '22023'; end if;
  if p_target_kind = 'live_room' then
    if not community.can_see_room(p_room) or exists (select 1 from community.live_rooms where id = p_room and host_id = auth.uid()) then raise exception 'not_found' using errcode = '42704'; end if;
    tid := p_room;
  elsif p_target_kind = 'live_message' then
    select * into m from community.live_messages where id = p_message;
    if not found or m.author_id = auth.uid() or not community.can_see_message(m.room_id, m.author_id, m.status) then raise exception 'not_found' using errcode = '42704'; end if;
    tid := community.msg_uuid(p_message);
  else raise exception 'invalid_target' using errcode = '22023'; end if;
  if exists (select 1 from community.reports where reporter_id = auth.uid() and target_kind = p_target_kind and target_id = tid and status = 'open') then
    return pg_catalog.jsonb_build_object('status', 'already_reported');
  end if;
  perform community.rate_check('report');
  insert into community.reports (reporter_id, target_kind, target_id, reason, details)
  values (auth.uid(), p_target_kind, tid, p_reason, pg_catalog.left(pg_catalog.regexp_replace(coalesce(p_details, ''), '[[:cntrl:]]', ' ', 'g'), 500)) returning id into rid;
  select count(distinct reporter_id) into n from community.reports where target_kind = p_target_kind and target_id = tid and status = 'open';
  if n >= 3 or p_reason = 'minor_safety' then
    if p_target_kind = 'live_room' then
      update community.live_rooms set status = 'hidden' where id = p_room and status in ('scheduled', 'live', 'ended');
    else
      update community.live_messages set status = 'hidden' where id = p_message and status = 'visible';
    end if;
    if found then
      hidden := true;
      insert into community.moderation_log (moderator_id, target_kind, target_id, action, reason, report_id)
      values (null, p_target_kind, tid, 'auto_hide', case when p_reason = 'minor_safety' then 'Sécurité des mineurs : masquage immédiat' else 'Trois signalements distincts' end, rid);
    end if;
  end if;
  return pg_catalog.jsonb_build_object('status', 'reported', 'id', rid, 'hidden', hidden);
end;
$$;

-- Modération d'un salon (masquer, rétablir, retirer), réservée au personnel, motif obligatoire
create function api.mod_live(p_room uuid, p_action text, p_reason text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not community.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  if coalesce(pg_catalog.btrim(p_reason), '') = '' then raise exception 'reason_required' using errcode = '22023'; end if;
  if p_action not in ('hide', 'restore', 'remove', 'dismiss') then raise exception 'invalid_action' using errcode = '22023'; end if;
  update community.live_rooms set status = case p_action when 'hide' then 'hidden' when 'remove' then 'removed'
    when 'restore' then case when ended_at is not null then 'ended' when started_at is not null then 'live' else 'scheduled' end else status end
  where id = p_room;
  if not found then raise exception 'not_found' using errcode = '42704'; end if;
  update community.reports set status = case when p_action in ('dismiss', 'restore') then 'dismissed' else 'actioned' end, resolved_at = now()
  where target_kind = 'live_room' and target_id = p_room and status = 'open';
  insert into community.moderation_log (moderator_id, target_kind, target_id, action, reason) values (auth.uid(), 'live_room', p_room, p_action, pg_catalog.left(p_reason, 500));
  return pg_catalog.jsonb_build_object('status', 'done', 'action', p_action);
end;
$$;

revoke all on function api.note_create(text, text, text[], jsonb, text, boolean), api.note_verdict(uuid, text), api.trending_tags(int),
  api.set_like_icon(text), api.live_create(text, text, text, text, text, timestamptz), api.live_set_status(uuid, text),
  api.live_say(uuid, text), api.live_unsay(bigint, text), api.live_vote(uuid, int), api.live_tally(uuid),
  api.report_live(text, uuid, bigint, text, text), api.mod_live(uuid, text, text) from public, anon;
grant execute on function api.note_create(text, text, text[], jsonb, text, boolean), api.note_verdict(uuid, text), api.trending_tags(int),
  api.set_like_icon(text), api.live_create(text, text, text, text, text, timestamptz), api.live_set_status(uuid, text),
  api.live_say(uuid, text), api.live_unsay(bigint, text), api.live_vote(uuid, int), api.live_tally(uuid),
  api.report_live(text, uuid, bigint, text, text), api.mod_live(uuid, text, text) to authenticated;

-- Temps réel : le chat du direct est diffusé (la RLS ci-dessus filtre chaque destinataire), si la publication existe
do $$
begin
  if exists (select 1 from pg_catalog.pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table community.live_messages';
  end if;
end;
$$;
