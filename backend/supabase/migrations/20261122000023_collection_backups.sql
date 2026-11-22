-- Migration 23 — Sauvegarde de la collection dans le compte (D-120). Additive : une table et trois fonctions, aucune donnée touchée. Appliquée en préproduction le 22/11/2026.
-- Une copie de la collection par compte, 8 Mo au plus. Mêmes garanties que les migrations précédentes :
--   aucune écriture ni lecture directe (la table n'est accessible qu'aux fonctions api.*), aucun accès anonyme,
--   une sauvegarde toutes les 20 secondes au plus, effacée en cascade avec le compte.
-- La restauration se fait sur l'appareil, par fusion (jamais d'écrasement silencieux).
-- La synchronisation champ par champ (api.sync_push / api.sync_pull) reste celle du lot 3.4.

create table if not exists app.collection_backups (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  payload     jsonb not null,
  item_count  integer not null default 0 check (item_count between 0 and 100000),
  bytes       integer not null check (bytes between 2 and 8388608),
  app_version text check (char_length(app_version) <= 40),
  updated_at  timestamptz not null default now(),
  constraint collection_backups_payload_object check (jsonb_typeof(payload) = 'object')
);
alter table app.collection_backups enable row level security;
revoke all on app.collection_backups from public, anon, authenticated;

create or replace function api.collection_backup_save(p_payload jsonb, p_items integer, p_version text default null)
  returns timestamptz language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  sz integer;
  last_at timestamptz;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then raise exception 'invalid_payload' using errcode = '22023'; end if;
  sz := octet_length(p_payload::text);
  if sz > 8388608 then raise exception 'payload_too_large' using errcode = '54000'; end if;
  select updated_at into last_at from app.collection_backups where user_id = uid;
  if last_at is not null and last_at > now() - interval '20 seconds' then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  insert into app.collection_backups (user_id, payload, item_count, bytes, app_version, updated_at)
    values (uid, p_payload, greatest(0, least(coalesce(p_items, 0), 100000)), greatest(sz, 2), left(p_version, 40), now())
  on conflict (user_id) do update set payload = excluded.payload, item_count = excluded.item_count, bytes = excluded.bytes,
    app_version = excluded.app_version, updated_at = now();
  return now();
end $$;

create or replace function api.collection_backup_get()
  returns table (payload jsonb, item_count integer, bytes integer, updated_at timestamptz)
  language sql stable security definer set search_path = '' as $$
  select b.payload, b.item_count, b.bytes, b.updated_at from app.collection_backups b where b.user_id = auth.uid();
$$;

create or replace function api.collection_backup_delete()
  returns boolean language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '42501'; end if;
  delete from app.collection_backups where user_id = auth.uid();
  return found;
end $$;

revoke all on function api.collection_backup_save(jsonb, integer, text) from public, anon;
revoke all on function api.collection_backup_get() from public, anon;
revoke all on function api.collection_backup_delete() from public, anon;
grant execute on function api.collection_backup_save(jsonb, integer, text) to authenticated;
grant execute on function api.collection_backup_get() to authenticated;
grant execute on function api.collection_backup_delete() to authenticated;
