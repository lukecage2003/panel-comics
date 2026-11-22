-- Migration 25 — Messagerie en ligne (D-125) : boîte de réception avec non-lus, groupes chiffrés par clés d'expéditeur,
-- messages vocaux chiffrés rangés dans un compartiment privé.
-- Additive : aucune table n'est supprimée, aucune donnée existante n'est effacée ; messaging.purge_expired garde sa signature.
-- Principes :
--   * non-lus : chaque membre note le dernier message lu par fil (conversation ou groupe) ; le compte se fait côté serveur ;
--   * groupes : 32 personnes au plus, adultes seulement, chaque ajout passe par messaging.can (blocage, mineurs, préférence) et
--     reste une invitation tant que la personne n'a pas accepté ; un membre ne voit que les messages envoyés après son arrivée ;
--   * chiffrement de groupe : chaque expéditeur a une clé de chaîne par « époque » ; il la confie à chaque membre, scellée pour la
--     clé d'identité du destinataire (ECDH éphémère) et signée ; un départ ou un retrait fait passer le groupe à l'époque suivante,
--     ce qui oblige chacun à changer de clé : la personne partie ne lit pas la suite. Le serveur ne voit que du chiffré ;
--   * vocaux : le fichier est chiffré sur l'appareil (clé aléatoire à usage unique, transmise DANS le message chiffré) ; le
--     compartiment « voice » est privé ; on n'écrit que dans son propre dossier d'un fil dont on est membre, on ne lit que les
--     fichiers des fils dont on est membre.

insert into community.limits (action, max_count, per_seconds) values
  ('group_create', 10, 86400), ('group_invite', 100, 86400), ('group_send', 300, 3600)
on conflict (action) do nothing;

-- ── Lu / non lu ─────────────────────────────────────────────────────────────────────────────────
create table messaging.reads (
  user_id    uuid not null references community.members (user_id) on delete cascade,
  thread_id  uuid not null,
  last_id    bigint not null default 0 check (last_id >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, thread_id)
);

-- ── Groupes ─────────────────────────────────────────────────────────────────────────────────────
create table messaging.groups (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 1 and 60 and name !~ '[<>[:cntrl:]]'),
  created_by uuid references community.members (user_id) on delete set null,
  epoch      int not null default 1 check (epoch > 0),
  timer_sec  int not null default 0 check (timer_sec in (0, 300, 3600, 86400, 604800)),
  created_at timestamptz not null default now()
);
create index groups_created_by on messaging.groups (created_by);
create table messaging.group_members (
  group_id   uuid not null references messaging.groups (id) on delete cascade,
  user_id    uuid not null references community.members (user_id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'admin', 'member')),
  status     text not null default 'invited' check (status in ('invited', 'active')),
  invited_by uuid references community.members (user_id) on delete set null,
  muted      boolean not null default false,
  since_id   bigint not null default 0,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user on messaging.group_members (user_id);
create index group_members_invited_by on messaging.group_members (invited_by);

-- Enveloppe de groupe : {v, alg, e (époque), n (rang dans la chaîne), iv, ct, sig (ECDSA P-256 de l'expéditeur)}
create function messaging.gbox_ok(p jsonb) returns boolean
language sql immutable set search_path = ''
as $$ select coalesce(pg_catalog.jsonb_typeof(p) = 'object'
  and (select pg_catalog.array_agg(k order by k) from pg_catalog.jsonb_object_keys(p) k) = array['alg', 'ct', 'e', 'iv', 'n', 'sig', 'v']
  and p ->> 'v' = 'g1' and p ->> 'alg' = 'SenderKey-P256/HMAC-SHA256/AES-GCM-256/ECDSA-P256'
  and pg_catalog.jsonb_typeof(p -> 'e') = 'number' and (p ->> 'e') ~ '^\d{1,9}$'
  and pg_catalog.jsonb_typeof(p -> 'n') = 'number' and (p ->> 'n') ~ '^\d{1,7}$'
  and (p ->> 'iv') ~ '^[A-Za-z0-9+/]{16}$' and (p ->> 'ct') ~ '^[A-Za-z0-9+/]+=*$' and char_length(p ->> 'ct') between 24 and 8000
  and (p ->> 'sig') ~ '^[A-Za-z0-9+/]{86}==$', false); $$;
-- Clé d'expéditeur confiée à un membre : {eph (clé publique éphémère), iv, ct, sig}
create function messaging.dist_ok(p jsonb) returns boolean
language sql immutable set search_path = ''
as $$ select coalesce(pg_catalog.jsonb_typeof(p) = 'object'
  and (select pg_catalog.array_agg(k order by k) from pg_catalog.jsonb_object_keys(p) k) = array['ct', 'eph', 'iv', 'sig']
  and messaging.pub_ok(p ->> 'eph') and (p ->> 'iv') ~ '^[A-Za-z0-9+/]{16}$'
  and (p ->> 'ct') ~ '^[A-Za-z0-9+/]+=*$' and char_length(p ->> 'ct') between 24 and 400
  and (p ->> 'sig') ~ '^[A-Za-z0-9+/]{86}==$', false); $$;

create table messaging.group_messages (
  id         bigint generated always as identity primary key,
  group_id   uuid not null references messaging.groups (id) on delete cascade,
  sender_id  uuid not null references community.members (user_id) on delete cascade,
  box        jsonb not null check (messaging.gbox_ok(box)),
  created_at timestamptz not null default now(),
  expires_at timestamptz
);
create index group_messages_group on messaging.group_messages (group_id, id);
create index group_messages_sender on messaging.group_messages (sender_id);
create index group_messages_expiry on messaging.group_messages (expires_at) where expires_at is not null;
create table messaging.group_keys (
  group_id     uuid not null references messaging.groups (id) on delete cascade,
  sender_id    uuid not null references community.members (user_id) on delete cascade,
  recipient_id uuid not null references community.members (user_id) on delete cascade,
  epoch        int not null check (epoch > 0),
  box          jsonb not null check (messaging.dist_ok(box)),
  created_at   timestamptz not null default now(),
  primary key (group_id, sender_id, recipient_id, epoch)
);
create index group_keys_sender on messaging.group_keys (sender_id);
create index group_keys_recipient on messaging.group_keys (recipient_id, group_id);

do $$ declare t text; begin
  foreach t in array array['messaging.reads', 'messaging.groups', 'messaging.group_members', 'messaging.group_messages', 'messaging.group_keys'] loop
    execute format('alter table %s enable row level security', t);
    execute format('revoke all on %s from public, anon, authenticated', t);
  end loop;
end $$;

-- ── Aides ───────────────────────────────────────────────────────────────────────────────────────
create function messaging.group_role(p_group uuid, p_user uuid) returns text
language sql security definer set search_path = '' stable
as $$ select g.role from messaging.group_members g where g.group_id = p_group and g.user_id = p_user and g.status = 'active'; $$;
create function messaging.handle_user(p_handle text) returns uuid
language sql security definer set search_path = '' stable
as $$ select user_id from community.members where handle = pg_catalog.btrim(coalesce(p_handle, ''))::extensions.citext; $$;
create function messaging.clean_name(p text) returns text
language sql immutable set search_path = ''
as $$ select pg_catalog.left(pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p, ''), '[[:cntrl:]<>]', '', 'g')), 60); $$;
revoke all on function messaging.group_role(uuid, uuid), messaging.handle_user(text), messaging.clean_name(text) from public, anon, authenticated;

-- ── Boîte de réception ──────────────────────────────────────────────────────────────────────────
create function api.messaging_me() returns jsonb
language sql security definer set search_path = '' stable
as $$ select pg_catalog.jsonb_build_object(
  'member', m.user_id is not null, 'handle', m.handle::text, 'adult', coalesce(community.is_adult(auth.uid()), false),
  'bundle', exists (select 1 from messaging.identities i where i.user_id = auth.uid()),
  'ik', (select i.ik from messaging.identities i where i.user_id = auth.uid()),
  'prekeys', (select count(*)::int from messaging.one_time_prekeys o where o.user_id = auth.uid()),
  'policy', coalesce((select p.policy from messaging.prefs p where p.user_id = auth.uid()), 'everyone'))
  from (select auth.uid() u) s left join community.members m on m.user_id = s.u; $$;

-- Conversations et groupes, avec le nombre de messages non lus de chacun
create function api.inbox() returns jsonb
language sql security definer set search_path = '' stable
as $$ select pg_catalog.jsonb_build_object(
  'dms', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', c.id, 'status', c.status, 'mine', c.requested_by = auth.uid(), 'with', m.handle::text,
      'seal', pro.seal_of(m.user_id), 'timer', c.timer_sec,
      'last_id', (select max(x.id) from messaging.messages x where x.conversation_id = c.id and (x.expires_at is null or x.expires_at > now())),
      'last_at', coalesce((select max(x.created_at) from messaging.messages x where x.conversation_id = c.id and (x.expires_at is null or x.expires_at > now())), c.created_at),
      'unread', (select count(*)::int from messaging.messages x where x.conversation_id = c.id and x.sender_id <> auth.uid() and x.id > coalesce(r.last_id, 0)
        and (x.expires_at is null or x.expires_at > now()))) order by c.created_at desc)
    from messaging.conversations c join community.members m on m.user_id = case when c.a = auth.uid() then c.b else c.a end
    left join messaging.reads r on r.user_id = auth.uid() and r.thread_id = c.id
    where auth.uid() in (c.a, c.b) and not community.blocked_between(c.a, c.b)), '[]'::jsonb),
  'groups', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', g.id, 'name', g.name, 'role', me.role, 'status', me.status, 'muted', me.muted, 'epoch', g.epoch,
      'members', (select count(*)::int from messaging.group_members y where y.group_id = g.id and y.status = 'active'),
      'invited_by', (select h.handle::text from community.members h where h.user_id = me.invited_by),
      'last_id', (select max(x.id) from messaging.group_messages x where x.group_id = g.id and x.id > me.since_id and (x.expires_at is null or x.expires_at > now())),
      'last_at', coalesce((select max(x.created_at) from messaging.group_messages x where x.group_id = g.id and x.id > me.since_id and (x.expires_at is null or x.expires_at > now())), me.created_at),
      'unread', case when me.status <> 'active' then 0 else (select count(*)::int from messaging.group_messages x where x.group_id = g.id and x.sender_id <> auth.uid()
        and x.id > greatest(me.since_id, coalesce(r.last_id, 0)) and (x.expires_at is null or x.expires_at > now())) end) order by g.created_at desc)
    from messaging.group_members me join messaging.groups g on g.id = me.group_id
    left join messaging.reads r on r.user_id = auth.uid() and r.thread_id = g.id
    where me.user_id = auth.uid()), '[]'::jsonb)); $$;

-- Marquer lu jusqu'à un message (jamais au-delà du dernier message réel du fil, jamais en arrière)
create function api.inbox_mark_read(p_thread uuid, p_upto bigint) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); top bigint;
begin
  if exists (select 1 from messaging.conversations c where c.id = p_thread and me in (c.a, c.b)) then
    select coalesce(max(id), 0) into top from messaging.messages where conversation_id = p_thread;
  elsif exists (select 1 from messaging.group_members g where g.group_id = p_thread and g.user_id = me and g.status = 'active') then
    select coalesce(max(id), 0) into top from messaging.group_messages where group_id = p_thread;
  else raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into messaging.reads (user_id, thread_id, last_id) values (me, p_thread, greatest(0, least(coalesce(p_upto, 0), top)))
    on conflict (user_id, thread_id) do update set last_id = greatest(messaging.reads.last_id, excluded.last_id), updated_at = now();
  return pg_catalog.jsonb_build_object('last_id', greatest(0, least(coalesce(p_upto, 0), top)));
end $$;

-- ── API Groupes ─────────────────────────────────────────────────────────────────────────────────
create function api.group_create(p_name text, p_handles text[]) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := pro.require_adult(); nm text := messaging.clean_name(p_name); gid uuid; h text; them uuid; why text; n int := 0; skipped jsonb := '[]'::jsonb;
begin
  if nm = '' then raise exception 'name_required' using errcode = '22023'; end if;
  if coalesce(cardinality(p_handles), 0) > 31 then raise exception 'group_full' using errcode = '22023'; end if;
  perform community.rate_check('group_create');
  insert into messaging.groups (name, created_by) values (nm, me) returning id into gid;
  insert into messaging.group_members (group_id, user_id, role, status) values (gid, me, 'owner', 'active');
  foreach h in array coalesce(p_handles, '{}'::text[]) loop
    them := messaging.handle_user(h);
    why := case when them is null then 'not_found' else messaging.can(me, them) end;
    if why <> '' then skipped := skipped || pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object('handle', pg_catalog.left(h, 24), 'reason', why)); continue; end if;
    insert into messaging.group_members (group_id, user_id, role, status, invited_by) values (gid, them, 'member', 'invited', me) on conflict do nothing;
    if found then n := n + 1; end if;
  end loop;
  return pg_catalog.jsonb_build_object('id', gid, 'invited', n, 'skipped', skipped);
end $$;

create function api.group_invite(p_group uuid, p_handle text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := pro.require_adult(); them uuid := messaging.handle_user(p_handle); why text;
begin
  if coalesce(messaging.group_role(p_group, me), '') not in ('owner', 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  if them is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  why := messaging.can(me, them);
  if why <> '' then raise exception '%', why using errcode = '42501'; end if;
  if (select count(*) from messaging.group_members where group_id = p_group) >= 32 then raise exception 'group_full' using errcode = '22023'; end if;
  perform community.rate_check('group_invite');
  insert into messaging.group_members (group_id, user_id, role, status, invited_by) values (p_group, them, 'member', 'invited', me) on conflict do nothing;
  return pg_catalog.jsonb_build_object('status', case when found then 'invited' else 'already' end);
end $$;

-- Accepter : on ne voit que les messages envoyés après ; refuser : l'invitation disparaît
create function api.group_respond(p_group uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := pro.require_adult();
begin
  if not exists (select 1 from messaging.group_members where group_id = p_group and user_id = me and status = 'invited') then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_accept then
    update messaging.group_members set status = 'active', since_id = coalesce((select max(id) from messaging.group_messages where group_id = p_group), 0)
      where group_id = p_group and user_id = me;
  else
    delete from messaging.group_members where group_id = p_group and user_id = me;
  end if;
  return pg_catalog.jsonb_build_object('status', case when p_accept then 'active' else 'declined' end);
end $$;

-- Départ ou retrait : le groupe change d'époque (nouvelles clés) ; le rôle de propriétaire passe au plus ancien ; un groupe vide s'efface
create function messaging.after_departure(p_group uuid) returns void
language plpgsql security definer set search_path = ''
as $$ begin
  if not exists (select 1 from messaging.group_members where group_id = p_group and status = 'active') then
    delete from messaging.groups where id = p_group; return;
  end if;
  if not exists (select 1 from messaging.group_members where group_id = p_group and role = 'owner' and status = 'active') then
    update messaging.group_members set role = 'owner' where (group_id, user_id) = (select group_id, user_id from messaging.group_members
      where group_id = p_group and status = 'active' order by (role = 'admin') desc, created_at limit 1);
  end if;
  update messaging.groups set epoch = epoch + 1 where id = p_group;
end $$;
revoke all on function messaging.after_departure(uuid) from public, anon, authenticated;

create function api.group_leave(p_group uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); was text;
begin
  delete from messaging.group_members where group_id = p_group and user_id = me returning status into was;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if was = 'active' then perform messaging.after_departure(p_group); end if;
  return pg_catalog.jsonb_build_object('status', 'left');
end $$;

create function api.group_remove(p_group uuid, p_handle text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); mine text := messaging.group_role(p_group, auth.uid()); them uuid := messaging.handle_user(p_handle); theirs text; was text;
begin
  select role into theirs from messaging.group_members where group_id = p_group and user_id = them;
  if them is null or theirs is null or them = me then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not (mine = 'owner' or (mine = 'admin' and theirs = 'member')) then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from messaging.group_members where group_id = p_group and user_id = them returning status into was;
  if was = 'active' then perform messaging.after_departure(p_group); end if;
  return pg_catalog.jsonb_build_object('status', 'removed');
end $$;

create function api.group_set_role(p_group uuid, p_handle text, p_role text) returns jsonb
language plpgsql security definer set search_path = ''
as $$ begin
  if p_role not in ('admin', 'member') then raise exception 'invalid_role' using errcode = '22023'; end if;
  if messaging.group_role(p_group, auth.uid()) is distinct from 'owner' then raise exception 'forbidden' using errcode = '42501'; end if;
  update messaging.group_members set role = p_role where group_id = p_group and user_id = messaging.handle_user(p_handle) and status = 'active' and role <> 'owner';
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  return pg_catalog.jsonb_build_object('role', p_role);
end $$;

create function api.group_rename(p_group uuid, p_name text) returns jsonb
language plpgsql security definer set search_path = ''
as $$ declare nm text := messaging.clean_name(p_name); begin
  if coalesce(messaging.group_role(p_group, auth.uid()), '') not in ('owner', 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  if nm = '' then raise exception 'name_required' using errcode = '22023'; end if;
  update messaging.groups set name = nm where id = p_group;
  return pg_catalog.jsonb_build_object('name', nm);
end $$;

-- Notifications du groupe : chacun choisit de le mettre en sourdine (le compteur reste, l'alerte se tait)
create function api.group_mute(p_group uuid, p_muted boolean) returns jsonb
language plpgsql security definer set search_path = ''
as $$ begin
  update messaging.group_members set muted = coalesce(p_muted, false) where group_id = p_group and user_id = auth.uid();
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  return pg_catalog.jsonb_build_object('muted', coalesce(p_muted, false));
end $$;

create function api.group_timer_set(p_group uuid, p_seconds int) returns jsonb
language plpgsql security definer set search_path = ''
as $$ begin
  if p_seconds not in (0, 300, 3600, 86400, 604800) then raise exception 'invalid_timer' using errcode = '22023'; end if;
  if coalesce(messaging.group_role(p_group, auth.uid()), '') not in ('owner', 'admin') then raise exception 'forbidden' using errcode = '42501'; end if;
  update messaging.groups set timer_sec = p_seconds where id = p_group;
  return pg_catalog.jsonb_build_object('timer', p_seconds);
end $$;

-- Membres (pour les membres et les invités seulement), avec leurs clés publiques d'identité et de signature
create function api.group_members(p_group uuid) returns jsonb
language plpgsql security definer set search_path = '' stable
as $$ begin
  if not exists (select 1 from messaging.group_members where group_id = p_group and user_id = auth.uid()) then raise exception 'not_found' using errcode = 'P0002'; end if;
  return (select pg_catalog.jsonb_build_object('epoch', g.epoch, 'name', g.name, 'timer', g.timer_sec, 'members', coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'handle', m.handle::text, 'me', gm.user_id = auth.uid(), 'role', gm.role, 'status', gm.status, 'seal', pro.seal_of(gm.user_id), 'ik', i.ik, 'sik', i.sik) order by gm.created_at)
    from messaging.group_members gm join community.members m on m.user_id = gm.user_id left join messaging.identities i on i.user_id = gm.user_id
    where gm.group_id = g.id), '[]'::jsonb)) from messaging.groups g where g.id = p_group);
end $$;

-- Envoi : chiffré seulement, à l'époque courante (sinon l'appareil doit d'abord changer de clé)
create function api.group_send(p_group uuid, p_box jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := pro.require_adult(); g messaging.groups; nid bigint;
begin
  if not messaging.gbox_ok(p_box) then raise exception 'invalid_box' using errcode = '22023'; end if;
  select * into g from messaging.groups where id = p_group for update;
  if not found or messaging.group_role(p_group, me) is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if (p_box ->> 'e')::int <> g.epoch then raise exception 'epoch_stale' using errcode = '40001'; end if;
  perform community.rate_check('group_send');
  insert into messaging.group_messages (group_id, sender_id, box, expires_at)
    values (p_group, me, p_box, case when g.timer_sec > 0 then now() + pg_catalog.make_interval(secs => g.timer_sec) end) returning id into nid;
  return pg_catalog.jsonb_build_object('id', nid, 'epoch', g.epoch, 'timer', g.timer_sec);
end $$;

create function api.group_messages(p_group uuid, p_after bigint default 0) returns jsonb
language sql security definer set search_path = '' stable
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', x.id, 'sender', m.handle::text, 'me', x.sender_id = auth.uid(), 'box', x.box, 'at', x.created_at,
    'expires', x.expires_at) order by x.id), '[]'::jsonb)
  from messaging.group_messages x join messaging.group_members me on me.group_id = x.group_id and me.user_id = auth.uid() and me.status = 'active'
  join community.members m on m.user_id = x.sender_id
  where x.group_id = p_group and x.id > greatest(me.since_id, coalesce(p_after, 0)) and (x.expires_at is null or x.expires_at > now());
$$;

-- Confier sa clé d'expéditeur de l'époque courante aux membres (32 au plus par appel)
create function api.group_key_put(p_group uuid, p_epoch int, p_keys jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := pro.require_adult(); k jsonb; them uuid; n int := 0;
begin
  if messaging.group_role(p_group, me) is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_epoch is distinct from (select epoch from messaging.groups where id = p_group) then raise exception 'epoch_stale' using errcode = '40001'; end if;
  if pg_catalog.jsonb_typeof(p_keys) <> 'array' or pg_catalog.jsonb_array_length(p_keys) > 32 then raise exception 'invalid_keys' using errcode = '22023'; end if;
  for k in select * from pg_catalog.jsonb_array_elements(p_keys) loop
    them := messaging.handle_user(k ->> 'to');
    if them is null or them = me or not exists (select 1 from messaging.group_members where group_id = p_group and user_id = them) then continue; end if;
    if not messaging.dist_ok(k -> 'box') then raise exception 'invalid_keys' using errcode = '22023'; end if;
    insert into messaging.group_keys (group_id, sender_id, recipient_id, epoch, box) values (p_group, me, them, p_epoch, k -> 'box')
      on conflict (group_id, sender_id, recipient_id, epoch) do update set box = excluded.box, created_at = now();
    n := n + 1;
  end loop;
  return pg_catalog.jsonb_build_object('stored', n);
end $$;

-- Les clés que les autres membres m'ont confiées
create function api.group_keys(p_group uuid) returns jsonb
language sql security definer set search_path = '' stable
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('sender', m.handle::text, 'epoch', k.epoch, 'box', k.box) order by k.epoch, k.created_at), '[]'::jsonb)
  from messaging.group_keys k join community.members m on m.user_id = k.sender_id
  where k.group_id = p_group and k.recipient_id = auth.uid() and exists (select 1 from messaging.group_members g where g.group_id = p_group and g.user_id = auth.uid());
$$;

-- Purge des messages échus : conversations et groupes (tâche planifiée, rôle service)
create or replace function messaging.purge_expired() returns int
language plpgsql security definer set search_path = ''
as $$ declare n int; m int; begin
  if auth.uid() is not null then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from messaging.messages where expires_at is not null and expires_at <= now();
  get diagnostics n = row_count;
  delete from messaging.group_messages where expires_at is not null and expires_at <= now();
  get diagnostics m = row_count;
  return n + m;
end $$;
revoke all on function messaging.purge_expired() from public, anon, authenticated;

-- ── Vocaux : compartiment privé ─────────────────────────────────────────────────────────────────
-- Chemin : <fil>/<expéditeur>/<32 caractères hexadécimaux>.bin ; le contenu est du chiffré (application/octet-stream), 4 Mo au plus
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice', 'voice', false, 4194304, array['application/octet-stream'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create function messaging.media_ok(p_name text, p_write boolean) returns boolean
language plpgsql security definer set search_path = '' stable
as $$
declare me uuid := auth.uid(); parts text[] := pg_catalog.string_to_array(coalesce(p_name, ''), '/'); t uuid;
  u text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if me is null or coalesce(cardinality(parts), 0) <> 3 or parts[1] !~ u or parts[2] !~ u or parts[3] !~ '^[0-9a-f]{32}\.bin$' then return false; end if;
  if p_write and (parts[2] <> me::text or not community.member_active(me) or not community.is_adult(me)) then return false; end if;
  t := parts[1]::uuid;
  return exists (select 1 from messaging.conversations c where c.id = t and me in (c.a, c.b) and c.status in ('request', 'active') and not community.blocked_between(c.a, c.b))
    or exists (select 1 from messaging.group_members g where g.group_id = t and g.user_id = me and g.status = 'active');
end $$;
revoke all on function messaging.media_ok(text, boolean) from public, anon;
grant execute on function messaging.media_ok(text, boolean) to authenticated;

create policy panel_voice_insert on storage.objects for insert to authenticated with check (bucket_id = 'voice' and messaging.media_ok(name, true));
create policy panel_voice_select on storage.objects for select to authenticated using (bucket_id = 'voice' and messaging.media_ok(name, false));
create policy panel_voice_delete on storage.objects for delete to authenticated using (bucket_id = 'voice' and messaging.media_ok(name, true));

revoke all on function api.messaging_me(), api.inbox(), api.inbox_mark_read(uuid, bigint), api.group_create(text, text[]), api.group_invite(uuid, text),
  api.group_respond(uuid, boolean), api.group_leave(uuid), api.group_remove(uuid, text), api.group_set_role(uuid, text, text), api.group_rename(uuid, text),
  api.group_mute(uuid, boolean), api.group_timer_set(uuid, int), api.group_members(uuid), api.group_send(uuid, jsonb), api.group_messages(uuid, bigint),
  api.group_key_put(uuid, int, jsonb), api.group_keys(uuid) from public, anon;
grant execute on function api.messaging_me(), api.inbox(), api.inbox_mark_read(uuid, bigint), api.group_create(text, text[]), api.group_invite(uuid, text),
  api.group_respond(uuid, boolean), api.group_leave(uuid), api.group_remove(uuid, text), api.group_set_role(uuid, text, text), api.group_rename(uuid, text),
  api.group_mute(uuid, boolean), api.group_timer_set(uuid, int), api.group_members(uuid), api.group_send(uuid, jsonb), api.group_messages(uuid, bigint),
  api.group_key_put(uuid, int, jsonb), api.group_keys(uuid) to authenticated;
