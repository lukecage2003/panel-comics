-- D-145 (migration 26) : accusés « Vu » réciproques et « Retirer pour tous ».
-- Additive : une colonne, une table, trois fonctions. Aucune donnée existante n'est modifiée.

-- Accusés de lecture : activés par défaut, réciproques (qui les coupe ne voit plus ceux des autres)
alter table messaging.prefs add column if not exists receipts boolean not null default true;

-- Messages retirés : seul l'identifiant reste, le texte chiffré est effacé du serveur
create table messaging.unsent (
  thread_id  uuid not null,
  message_id bigint not null,
  sender_id  uuid not null references community.members (user_id) on delete cascade,
  at         timestamptz not null default now(),
  primary key (thread_id, message_id)
);
create index unsent_sender on messaging.unsent (sender_id);
alter table messaging.unsent enable row level security;
revoke all on messaging.unsent from public, anon, authenticated;

create function messaging.receipts_on(p_user uuid) returns boolean
language sql security definer set search_path = '' stable
as $$ select coalesce((select p.receipts from messaging.prefs p where p.user_id = p_user), true); $$;
revoke all on function messaging.receipts_on(uuid) from public, anon, authenticated;

create function api.dm_receipts_set(p_on boolean) returns jsonb
language plpgsql security definer set search_path = ''
as $$ begin
  if auth.uid() is null or not exists (select 1 from community.members m where m.user_id = auth.uid()) then raise exception 'forbidden' using errcode = '42501'; end if;
  insert into messaging.prefs (user_id, receipts) values (auth.uid(), coalesce(p_on, true))
    on conflict (user_id) do update set receipts = coalesce(p_on, true);
  return pg_catalog.jsonb_build_object('receipts', coalesce(p_on, true));
end $$;

-- État d'un fil : jusqu'où les autres ont lu (si les deux côtés gardent les accusés) et messages retirés
create function api.thread_state(p_thread uuid) returns jsonb
language plpgsql security definer set search_path = '' stable
as $$
declare me uuid := auth.uid(); c messaging.conversations; mine boolean := messaging.receipts_on(auth.uid()); seen jsonb := null; gone jsonb;
begin
  select * into c from messaging.conversations where id = p_thread and me in (a, b);
  if found then
    if mine and messaging.receipts_on(case when c.a = me then c.b else c.a end) then
      select pg_catalog.jsonb_build_object('upto', r.last_id, 'at', r.updated_at) into seen
        from messaging.reads r where r.thread_id = c.id and r.user_id = case when c.a = me then c.b else c.a end;
    end if;
  elsif exists (select 1 from messaging.group_members g where g.group_id = p_thread and g.user_id = me and g.status = 'active') then
    if mine then
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('upto', r.last_id) order by r.last_id desc) into seen
        from messaging.reads r join messaging.group_members g on g.group_id = p_thread and g.user_id = r.user_id and g.status = 'active'
        where r.thread_id = p_thread and r.user_id <> me and messaging.receipts_on(r.user_id);
    end if;
  else raise exception 'not_found' using errcode = 'P0002'; end if;
  select coalesce(pg_catalog.jsonb_agg(u.message_id order by u.message_id), '[]'::jsonb) into gone
    from (select x.message_id from messaging.unsent x where x.thread_id = p_thread order by x.message_id desc limit 500) u;
  return pg_catalog.jsonb_build_object('receipts', mine, 'seen', seen, 'unsent', gone);
end $$;

-- Retirer pour tous : seulement ses propres messages ; le texte chiffré est supprimé, l'identifiant reste comme trace
create function api.msg_unsend(p_thread uuid, p_message bigint) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare me uuid := auth.uid(); n int := 0;
begin
  if exists (select 1 from messaging.conversations c where c.id = p_thread and me in (c.a, c.b)) then
    delete from messaging.messages where id = p_message and conversation_id = p_thread and sender_id = me;
    get diagnostics n = row_count;
  elsif exists (select 1 from messaging.group_members g where g.group_id = p_thread and g.user_id = me and g.status = 'active') then
    delete from messaging.group_messages where id = p_message and group_id = p_thread and sender_id = me;
    get diagnostics n = row_count;
  else raise exception 'not_found' using errcode = 'P0002'; end if;
  if n = 0 then raise exception 'not_found' using errcode = 'P0002'; end if;
  insert into messaging.unsent (thread_id, message_id, sender_id) values (p_thread, p_message, me) on conflict do nothing;
  return pg_catalog.jsonb_build_object('unsent', p_message);
end $$;

revoke all on function api.dm_receipts_set(boolean), api.thread_state(uuid), api.msg_unsend(uuid, bigint) from public, anon;
grant execute on function api.dm_receipts_set(boolean), api.thread_state(uuid), api.msg_unsend(uuid, bigint) to authenticated;
