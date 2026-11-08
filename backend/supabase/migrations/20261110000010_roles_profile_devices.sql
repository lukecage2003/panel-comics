-- Lot 3.3 (local, D-38) — Rôles serveur, profil, préférences synchronisées (HLC), appareils.
-- Migration additive : une table et deux colonnes ajoutées, aucune donnée supprimée ou réécrite.
--   app.staff_roles / app.staff_role_log : rôles admin, editor, moderator attribués par le service seulement (aucune interface
--                                          publique) ; un rôle ne donne AUCUN accès aux données personnelles (aucune politique
--                                          RLS de app.* ne consulte les rôles : A10, prouvé par backend/tests/roles.test.js).
--   app.has_role(role)                   : vrai si l'utilisateur connecté possède ce rôle (pour les futurs schémas Explorer).
--   api.my_profile / api.update_profile  : profil minimal (nom affiché, langue, marché préféré), « tout privé » par défaut.
--   api.settings_get / api.settings_merge: préférences fusionnées clé par clé par horloge logique hybride ; une valeur identique
--                                          n'écrit rien (pas de boucle entre appareils) ; appareil révoqué refusé.
--   api.register_device / api.list_devices / api.revoke_device : appareils ; la révocation est définitive et écrite par le serveur.

create table app.staff_roles (
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null check (role in ('admin', 'editor', 'moderator')),
  granted_by text not null check (char_length(granted_by) between 1 and 120),
  granted_at timestamptz not null default now(),
  primary key (user_id, role)
);
alter table app.staff_roles enable row level security;
-- Lecture de ses propres rôles seulement ; aucune écriture client (ni insert, ni update, ni delete).
create policy staff_roles_select_own on app.staff_roles for select to authenticated using ((select auth.uid()) = user_id);
revoke all on app.staff_roles from public, anon, authenticated;
grant select on app.staff_roles to authenticated;

create table app.staff_role_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null,
  role       text not null,
  action     text not null check (action in ('grant', 'revoke')),
  actor      text not null,
  reason     text,
  created_at timestamptz not null default now()
);
alter table app.staff_role_log enable row level security;
revoke all on app.staff_role_log from public, anon, authenticated;

create function app.has_role(p_role text) returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (select 1 from app.staff_roles r where r.user_id = auth.uid() and r.role = p_role);
$$;
revoke all on function app.has_role(text) from public, anon;
grant execute on function app.has_role(text) to authenticated;

-- Attribution et retrait : service seulement, journalisés, idempotents.
create function app.grant_role(p_user uuid, p_role text, p_actor text, p_reason text default null) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare c int;
begin
  if p_user is null or p_role is null or p_role not in ('admin', 'editor', 'moderator') or coalesce(p_actor, '') = '' then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  insert into app.staff_roles (user_id, role, granted_by) values (p_user, p_role, p_actor) on conflict do nothing;
  get diagnostics c = row_count;
  if c > 0 then insert into app.staff_role_log (user_id, role, action, actor, reason) values (p_user, p_role, 'grant', p_actor, p_reason); end if;
  return pg_catalog.jsonb_build_object('status', case when c > 0 then 'granted' else 'unchanged' end);
end;
$$;
create function app.revoke_role(p_user uuid, p_role text, p_actor text, p_reason text default null) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare c int;
begin
  if p_user is null or p_role is null or coalesce(p_actor, '') = '' then raise exception 'invalid_role' using errcode = '22023'; end if;
  delete from app.staff_roles where user_id = p_user and role = p_role;
  get diagnostics c = row_count;
  if c > 0 then insert into app.staff_role_log (user_id, role, action, actor, reason) values (p_user, p_role, 'revoke', p_actor, p_reason); end if;
  return pg_catalog.jsonb_build_object('status', case when c > 0 then 'revoked' else 'unchanged' end);
end;
$$;
revoke all on function app.grant_role(uuid, text, text, text) from public, anon, authenticated;
revoke all on function app.revoke_role(uuid, text, text, text) from public, anon, authenticated;

create function api.my_roles() returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(pg_catalog.jsonb_agg(r.role order by r.role), '[]'::jsonb) from app.staff_roles r where r.user_id = auth.uid();
$$;
revoke all on function api.my_roles() from public, anon;
grant execute on function api.my_roles() to authenticated;

-- ── Profil ──────────────────────────────────────────────────────────────────────────────────────────
create function api.my_profile() returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid(); res jsonb;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  insert into app.profiles (user_id) values (uid) on conflict do nothing;
  insert into app.user_settings (user_id) select uid where not exists (select 1 from app.user_settings where user_id = uid);
  select pg_catalog.jsonb_build_object('display_name', p.display_name, 'locale', p.locale, 'preferred_market', p.preferred_market,
    'handle', p.handle, 'privacy', s.privacy)
    into res from app.profiles p join app.user_settings s on s.user_id = p.user_id where p.user_id = uid;
  return res;
end;
$$;
create function api.update_profile(p_patch jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid(); k text;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_patch is null or pg_catalog.jsonb_typeof(p_patch) <> 'object' then raise exception 'invalid_profile' using errcode = '22023'; end if;
  for k in select pg_catalog.jsonb_object_keys(p_patch) loop
    if k not in ('display_name', 'locale', 'preferred_market') then raise exception 'invalid_profile_field' using errcode = '22023'; end if;
  end loop;
  if p_patch ? 'locale' and coalesce(p_patch->>'locale', '') not in ('fr', 'en') then raise exception 'invalid_locale' using errcode = '22023'; end if;
  if p_patch ? 'preferred_market' and p_patch->>'preferred_market' is not null and p_patch->>'preferred_market' not in ('FR', 'US') then
    raise exception 'invalid_market' using errcode = '22023';
  end if;
  insert into app.profiles (user_id) values (uid) on conflict do nothing;
  update app.profiles set
    display_name = case when p_patch ? 'display_name' then nullif(pg_catalog.btrim(p_patch->>'display_name'), '') else display_name end,
    locale = case when p_patch ? 'locale' then p_patch->>'locale' else locale end,
    preferred_market = case when p_patch ? 'preferred_market' then p_patch->>'preferred_market' else preferred_market end
  where user_id = uid;
  return api.my_profile();
end;
$$;
revoke all on function api.my_profile() from public, anon;
revoke all on function api.update_profile(jsonb) from public, anon;
grant execute on function api.my_profile() to authenticated;
grant execute on function api.update_profile(jsonb) to authenticated;

-- ── Préférences : fusion par clé, horloge logique hybride (HLC « 0000000000000-0000-appareil », ordre lexical) ──
alter table app.user_settings add column prefs_hlc jsonb not null default '{}'::jsonb;

create function app.active_device(p_device uuid) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare d record;
begin
  select user_id, revoked_at into d from app.devices where id = p_device;
  if not found or d.user_id is distinct from auth.uid() then raise exception 'unknown_device' using errcode = '22023'; end if;
  if d.revoked_at is not null then raise exception 'device_revoked' using errcode = '42501'; end if;
  update app.devices set last_seen_at = pg_catalog.now() where id = p_device;
end;
$$;
revoke all on function app.active_device(uuid) from public, anon, authenticated;

create function api.settings_get() returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid(); res jsonb;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  insert into app.user_settings (user_id) select uid where not exists (select 1 from app.user_settings where user_id = uid);
  select pg_catalog.jsonb_build_object('prefs', s.prefs, 'hlc', s.prefs_hlc, 'rev', s.rev) into res from app.user_settings s where s.user_id = uid;
  return res;
end;
$$;

create function api.settings_merge(p_device uuid, p_prefs jsonb, p_hlc jsonb) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  cur record; k text; v jsonb; h text; applied text[] := '{}'; ignored text[] := '{}';
  np jsonb; nh jsonb;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  perform app.active_device(p_device);
  if p_prefs is null or p_hlc is null or pg_catalog.jsonb_typeof(p_prefs) <> 'object' or pg_catalog.jsonb_typeof(p_hlc) <> 'object' then
    raise exception 'invalid_settings' using errcode = '22023';
  end if;
  if octet_length(p_prefs::text) > 32768 then raise exception 'payload_too_large' using errcode = '54000'; end if;
  insert into app.user_settings (user_id) select uid where not exists (select 1 from app.user_settings where user_id = uid);
  select prefs, prefs_hlc into cur from app.user_settings where user_id = uid for update;
  np := cur.prefs; nh := cur.prefs_hlc;
  for k, v in select * from pg_catalog.jsonb_each(p_prefs) loop
    h := p_hlc->>k;
    if h is null or h !~ '^[0-9]{13}-[0-9]{4}-[A-Za-z0-9_-]{1,64}$' then raise exception 'invalid_hlc' using errcode = '22023'; end if;
    if (nh->>k) is not null and h <= (nh->>k) then ignored := ignored || k; continue; end if;   -- plus ancien ou égal : ignoré
    if np->k is not distinct from v then nh := nh || pg_catalog.jsonb_build_object(k, h); continue; end if; -- même valeur : horloge seule
    np := np || pg_catalog.jsonb_build_object(k, v); nh := nh || pg_catalog.jsonb_build_object(k, h); applied := applied || k;
  end loop;
  if np is distinct from cur.prefs then
    update app.user_settings set prefs = np, prefs_hlc = nh where user_id = uid;
  elsif nh is distinct from cur.prefs_hlc then
    update app.user_settings set prefs_hlc = nh where user_id = uid; -- horloge avancée seule ; la suivante identique est ignorée
  end if;
  return pg_catalog.jsonb_build_object('applied', pg_catalog.to_jsonb(applied), 'ignored', pg_catalog.to_jsonb(ignored)) || api.settings_get();
end;
$$;
revoke all on function api.settings_get() from public, anon;
revoke all on function api.settings_merge(uuid, jsonb, jsonb) from public, anon;
grant execute on function api.settings_get() to authenticated;
grant execute on function api.settings_merge(uuid, jsonb, jsonb) to authenticated;

-- ── Appareils ──────────────────────────────────────────────────────────────────────────────────────
create function api.register_device(p_label text, p_platform text, p_app_version text default null) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid(); n int; id uuid;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_platform not in ('web', 'android') then raise exception 'invalid_platform' using errcode = '22023'; end if;
  select count(*) into n from app.devices where user_id = uid and revoked_at is null;
  if n >= 20 then raise exception 'too_many_devices' using errcode = '54000'; end if;
  insert into app.devices (user_id, label, platform, app_version, last_seen_at)
    values (uid, nullif(pg_catalog.left(pg_catalog.btrim(coalesce(p_label, '')), 80), ''), p_platform, pg_catalog.left(p_app_version, 40), pg_catalog.now())
    returning devices.id into id;
  return id;
end;
$$;
create function api.list_devices() returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', d.id, 'label', d.label, 'platform', d.platform,
    'app_version', d.app_version, 'created_at', d.created_at, 'last_seen_at', d.last_seen_at, 'revoked', d.revoked_at is not null)
    order by d.created_at), '[]'::jsonb)
  from app.devices d where d.user_id = auth.uid();
$$;
create function api.revoke_device(p_device uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := auth.uid(); c int;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update app.devices set revoked_at = pg_catalog.now() where id = p_device and user_id = uid and revoked_at is null;
  get diagnostics c = row_count;
  if c = 0 and not exists (select 1 from app.devices where id = p_device and user_id = uid) then raise exception 'unknown_device' using errcode = '22023'; end if;
  return pg_catalog.jsonb_build_object('status', case when c > 0 then 'revoked' else 'already_revoked' end);
end;
$$;
revoke all on function api.register_device(text, text, text) from public, anon;
revoke all on function api.list_devices() from public, anon;
revoke all on function api.revoke_device(uuid) from public, anon;
grant execute on function api.register_device(text, text, text) to authenticated;
grant execute on function api.list_devices() to authenticated;
grant execute on function api.revoke_device(uuid) to authenticated;
