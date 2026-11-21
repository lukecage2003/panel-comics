-- D-98 : co-animation des directs. Additive : une table, des fonctions ; rien n'est supprimé ni réécrit.
-- Rôles : « cohost » (anime avec l'hôte : peut passer au point suivant, retirer un message) et « moderator » (retire les messages).
-- Toutes les éventualités prévues :
--   invitation refusée, expirée (24 h), annulée par l'hôte ; co-animateur qui part ou est retiré ; trois places au plus ;
--   on ne s'invite pas soi-même ; pas d'invitation entre comptes bloqués, suspendus, ni entre mineurs et adultes ;
--   l'hôte qui quitte un direct en cours le passe au premier co-animateur accepté, sinon le direct se termine ;
--   un salon terminé ou retiré n'accepte plus d'invitation ; limite de 20 invitations par jour.

create table community.live_hosts (
  room_id      uuid not null references community.live_rooms (id) on delete cascade,
  user_id      uuid not null references community.members (user_id) on delete cascade,
  role         text not null default 'cohost' check (role in ('cohost', 'moderator')),
  status       text not null default 'invited' check (status in ('invited', 'accepted', 'declined', 'left', 'removed', 'expired')),
  invited_by   uuid references community.members (user_id) on delete set null,
  invited_at   timestamptz not null default now(),
  responded_at timestamptz,
  primary key (room_id, user_id)
);
create index live_hosts_user_idx on community.live_hosts (user_id, status);

insert into community.limits (action, max_count, per_seconds) values ('invite', 20, 86400) on conflict (action) do nothing;

alter table community.live_hosts enable row level security;
revoke all on community.live_hosts from public, anon, authenticated;
grant select on community.live_hosts to authenticated;

-- L'appelant anime-t-il ce salon (hôte ou co-animateur accepté) ? p_mod_ok : un modérateur de salon suffit
create function community.room_role(p_room uuid) returns text
language sql security definer set search_path = '' stable
as $$
  select case
    when exists (select 1 from community.live_rooms r where r.id = p_room and r.host_id = auth.uid()) then 'host'
    else (select h.role from community.live_hosts h where h.room_id = p_room and h.user_id = auth.uid() and h.status = 'accepted')
  end;
$$;
revoke all on function community.room_role(uuid) from public, anon;
grant execute on function community.room_role(uuid) to authenticated;

-- Lecture : l'hôte et l'équipe du salon voient toute l'équipe ; l'invité voit sa propre ligne ; les spectateurs voient l'équipe acceptée
create policy live_hosts_select on community.live_hosts for select to authenticated using (
  user_id = (select auth.uid()) or community.room_role(room_id) is not null or community.is_staff()
  or (status = 'accepted' and community.can_see_room(room_id))
);

-- ---------- Inviter (hôte seulement)
create function api.live_invite(p_room uuid, p_handle text, p_role text default 'cohost') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare r record; target uuid; n int;
begin
  if p_role not in ('cohost', 'moderator') then raise exception 'invalid_role' using errcode = '22023'; end if;
  select * into r from community.live_rooms where id = p_room and host_id = auth.uid();
  if not found then raise exception 'not_found' using errcode = '42704'; end if;
  if r.status not in ('scheduled', 'live') then raise exception 'room_closed' using errcode = '22023'; end if;
  if not community.member_active(auth.uid()) then raise exception 'not_allowed' using errcode = '42501'; end if;
  select user_id into target from community.members where handle = pg_catalog.btrim(coalesce(p_handle, ''))::extensions.citext;
  -- Compte introuvable, bloqué ou d'un autre groupe d'âge : même réponse, pour ne rien révéler
  if target is null or not community.member_active(target) or community.blocked_between(auth.uid(), target)
     or community.is_adult(target) <> community.is_adult(auth.uid()) then
    raise exception 'cannot_invite' using errcode = '42501';
  end if;
  if target = auth.uid() then raise exception 'self_invite' using errcode = '22023'; end if;
  update community.live_hosts set status = 'expired' where room_id = p_room and status = 'invited' and invited_at < now() - interval '24 hours';
  if exists (select 1 from community.live_hosts where room_id = p_room and user_id = target and status in ('invited', 'accepted')) then
    raise exception 'already_invited' using errcode = '23505';
  end if;
  select count(*) into n from community.live_hosts where room_id = p_room and status in ('invited', 'accepted');
  if n >= 3 then raise exception 'team_full' using errcode = '53400'; end if;
  perform community.rate_check('invite');
  insert into community.live_hosts (room_id, user_id, role, status, invited_by, invited_at, responded_at)
  values (p_room, target, p_role, 'invited', auth.uid(), now(), null)
  on conflict (room_id, user_id) do update set role = excluded.role, status = 'invited', invited_by = excluded.invited_by, invited_at = now(), responded_at = null;
  return pg_catalog.jsonb_build_object('status', 'invited', 'role', p_role);
end;
$$;

-- ---------- Répondre à une invitation (l'invité)
create function api.live_invite_respond(p_room uuid, p_accept boolean) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare h record; st text;
begin
  select * into h from community.live_hosts where room_id = p_room and user_id = auth.uid() and status = 'invited';
  if not found then raise exception 'not_found' using errcode = '42704'; end if;
  if h.invited_at < now() - interval '24 hours' then
    update community.live_hosts set status = 'expired' where room_id = p_room and user_id = auth.uid();
    raise exception 'expired' using errcode = '22023';
  end if;
  if not exists (select 1 from community.live_rooms where id = p_room and status in ('scheduled', 'live')) then raise exception 'room_closed' using errcode = '22023'; end if;
  st := case when p_accept then 'accepted' else 'declined' end;
  if p_accept and not community.member_active(auth.uid()) then raise exception 'not_allowed' using errcode = '42501'; end if;
  update community.live_hosts set status = st, responded_at = now() where room_id = p_room and user_id = auth.uid();
  return pg_catalog.jsonb_build_object('status', st);
end;
$$;

-- ---------- Retirer quelqu'un de l'équipe (hôte) ou annuler une invitation
create function api.live_host_remove(p_room uuid, p_handle text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare target uuid; c int;
begin
  if not exists (select 1 from community.live_rooms where id = p_room and host_id = auth.uid()) then raise exception 'not_found' using errcode = '42704'; end if;
  select user_id into target from community.members where handle = pg_catalog.btrim(coalesce(p_handle, ''))::extensions.citext;
  update community.live_hosts set status = 'removed', responded_at = now() where room_id = p_room and user_id = target and status in ('invited', 'accepted');
  get diagnostics c = row_count;
  if c = 0 then raise exception 'not_found' using errcode = '42704'; end if;
  return pg_catalog.jsonb_build_object('status', 'removed');
end;
$$;

-- ---------- Quitter : un co-animateur part ; l'hôte qui part d'un direct en cours le passe au premier co-animateur accepté
create function api.live_leave(p_room uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare r record; heir uuid;
begin
  select * into r from community.live_rooms where id = p_room;
  if not found then raise exception 'not_found' using errcode = '42704'; end if;
  if r.host_id <> auth.uid() then
    update community.live_hosts set status = 'left', responded_at = now() where room_id = p_room and user_id = auth.uid() and status in ('invited', 'accepted');
    if not found then raise exception 'not_found' using errcode = '42704'; end if;
    return pg_catalog.jsonb_build_object('status', 'left');
  end if;
  if r.status <> 'live' then raise exception 'not_live' using errcode = '22023'; end if;
  select h.user_id into heir from community.live_hosts h
  where h.room_id = p_room and h.status = 'accepted' and h.role = 'cohost' and community.member_active(h.user_id)
  order by h.responded_at, h.invited_at limit 1;
  if heir is null then
    update community.live_rooms set status = 'ended', ended_at = now() where id = p_room;
    return pg_catalog.jsonb_build_object('status', 'ended');
  end if;
  update community.live_rooms set host_id = heir where id = p_room;
  delete from community.live_hosts where room_id = p_room and user_id = heir;
  insert into community.live_hosts (room_id, user_id, role, status, invited_by, invited_at, responded_at)
  values (p_room, auth.uid(), 'cohost', 'left', heir, now(), now())
  on conflict (room_id, user_id) do update set status = 'left', responded_at = now();
  return pg_catalog.jsonb_build_object('status', 'handed_over');
end;
$$;

-- ---------- L'équipe du salon modère le chat : même règle que l'hôte, consignée au journal
create or replace function api.live_unsay(p_message bigint, p_reason text default '') returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare m record; host uuid; my_role text;
begin
  select * into m from community.live_messages where id = p_message;
  if not found then raise exception 'not_found' using errcode = '42704'; end if;
  select host_id into host from community.live_rooms where id = m.room_id;
  my_role := community.room_role(m.room_id);
  if m.author_id = auth.uid() then
    update community.live_messages set status = 'deleted', body = '–' where id = p_message;
  elsif my_role is not null or community.is_staff() then
    -- Un co-animateur ne retire pas les messages de l'hôte
    if m.author_id = host and my_role <> 'host' and not community.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
    update community.live_messages set status = 'removed' where id = p_message;
    insert into community.moderation_log (moderator_id, target_kind, target_id, action, reason)
    values (auth.uid(), 'live_message', community.msg_uuid(p_message), 'remove', pg_catalog.left(coalesce(nullif(pg_catalog.btrim(p_reason), ''),
      case my_role when 'host' then 'Retiré par l''hôte' when 'cohost' then 'Retiré par un co-animateur' when 'moderator' then 'Retiré par un modérateur du salon' else 'Modération' end), 500));
  else raise exception 'forbidden' using errcode = '42501';
  end if;
  return pg_catalog.jsonb_build_object('status', 'removed');
end;
$$;

-- ---------- Invitations en attente pour l'appelant (boîte de réception)
create function api.live_my_invites() returns jsonb
language sql security definer set search_path = '' stable
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('room', r.id, 'title', r.title, 'role', h.role, 'host', m.handle::text, 'invited_at', h.invited_at) order by h.invited_at desc), '[]'::jsonb)
  from community.live_hosts h
  join community.live_rooms r on r.id = h.room_id and r.status in ('scheduled', 'live')
  join community.members m on m.user_id = r.host_id
  where h.user_id = auth.uid() and h.status = 'invited' and h.invited_at >= now() - interval '24 hours'
    and not community.blocked_between(auth.uid(), r.host_id);
$$;

revoke all on function api.live_invite(uuid, text, text), api.live_invite_respond(uuid, boolean), api.live_host_remove(uuid, text),
  api.live_leave(uuid), api.live_my_invites() from public, anon;
grant execute on function api.live_invite(uuid, text, text), api.live_invite_respond(uuid, boolean), api.live_host_remove(uuid, text),
  api.live_leave(uuid), api.live_my_invites() to authenticated;
