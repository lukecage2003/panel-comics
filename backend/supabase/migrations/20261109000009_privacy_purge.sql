-- Lot 3.6 (local, D-35) — Portabilité, effacement des données personnelles, purge des pierres tombales.
-- Migration additive : aucune table modifiée, aucune donnée supprimée par la migration elle-même.
--   api.export_my_data()          : toutes les lignes de l'utilisateur connecté (pierres tombales comprises), sans identifiant d'autrui.
--   api.delete_my_data(confirm)   : efface toutes les données de l'utilisateur connecté, seulement avec la phrase exacte ; le compte
--                                   d'authentification (auth.users) est supprimé par le service d'administration, hors de cette fonction.
--   app.purge_tombstones(...)     : réservé au service (aucun droit client) ; supprime les pierres tombales anciennes, les opérations
--                                   d'idempotence anciennes, et relève purged_below_rev pour forcer la resynchronisation des curseurs anciens.

create function api.export_my_data() returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  uid uuid := auth.uid();
  res jsonb;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select pg_catalog.jsonb_build_object(
    'format', 'panel-account-export', 'version', 1, 'exported_at', pg_catalog.now(),
    'profile', (select pg_catalog.to_jsonb(p) - 'user_id' from app.profiles p where p.user_id = uid),
    'settings', (select pg_catalog.to_jsonb(s) - 'user_id' from app.user_settings s where s.user_id = uid),
    'devices', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(d) - 'user_id' order by d.created_at) from app.devices d where d.user_id = uid), '[]'::jsonb),
    'copies', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) - 'user_id' order by x.id) from app.copies x where x.user_id = uid), '[]'::jsonb),
    'locations', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) - 'user_id' order by x.id) from app.locations x where x.user_id = uid), '[]'::jsonb),
    'pulls', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) - 'user_id' order by x.id) from app.pulls x where x.user_id = uid), '[]'::jsonb),
    'series_follows', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) - 'user_id' order by x.id) from app.series_follows x where x.user_id = uid), '[]'::jsonb),
    'reading_progress', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) - 'user_id' order by x.id) from app.reading_progress x where x.user_id = uid), '[]'::jsonb),
    'reading_states', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) - 'user_id' order by x.id) from app.reading_states x where x.user_id = uid), '[]'::jsonb),
    'sync_conflicts', coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(x) - 'user_id' order by x.created_at) from app.sync_conflicts x where x.user_id = uid), '[]'::jsonb)
  ) into res;
  return res;
end;
$$;
revoke all on function api.export_my_data() from public, anon;
grant execute on function api.export_my_data() to authenticated;

create function api.delete_my_data(p_confirm text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  n jsonb := '{}'::jsonb; c int;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_confirm is distinct from 'SUPPRIMER MES DONNÉES' then raise exception 'confirmation_required' using errcode = '22023'; end if;
  delete from app.sync_conflicts where user_id = uid; get diagnostics c = row_count; n := n || pg_catalog.jsonb_build_object('sync_conflicts', c);
  delete from app.sync_ops where user_id = uid; get diagnostics c = row_count; n := n || pg_catalog.jsonb_build_object('sync_ops', c);
  delete from app.copies where user_id = uid; get diagnostics c = row_count; n := n || pg_catalog.jsonb_build_object('copies', c);
  delete from app.locations where user_id = uid; get diagnostics c = row_count; n := n || pg_catalog.jsonb_build_object('locations', c);
  delete from app.pulls where user_id = uid; get diagnostics c = row_count; n := n || pg_catalog.jsonb_build_object('pulls', c);
  delete from app.series_follows where user_id = uid; get diagnostics c = row_count; n := n || pg_catalog.jsonb_build_object('series_follows', c);
  delete from app.reading_progress where user_id = uid; get diagnostics c = row_count; n := n || pg_catalog.jsonb_build_object('reading_progress', c);
  delete from app.reading_states where user_id = uid; get diagnostics c = row_count; n := n || pg_catalog.jsonb_build_object('reading_states', c);
  delete from app.devices where user_id = uid; get diagnostics c = row_count; n := n || pg_catalog.jsonb_build_object('devices', c);
  delete from app.user_settings where user_id = uid; get diagnostics c = row_count; n := n || pg_catalog.jsonb_build_object('user_settings', c);
  delete from app.profiles where user_id = uid; get diagnostics c = row_count; n := n || pg_catalog.jsonb_build_object('profiles', c);
  delete from app.user_sync_state where user_id = uid; get diagnostics c = row_count; n := n || pg_catalog.jsonb_build_object('user_sync_state', c);
  return pg_catalog.jsonb_build_object('status', 'deleted', 'counts', n);
end;
$$;
revoke all on function api.delete_my_data(text) from public, anon;
grant execute on function api.delete_my_data(text) to authenticated;

create function app.purge_tombstones(p_user uuid, p_older_than interval, p_ops_older_than interval default interval '90 days') returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cutoff timestamptz := pg_catalog.now() - p_older_than;
  top bigint := 0; m bigint; c int; total int := 0; ops int;
begin
  if p_user is null or p_older_than is null or p_older_than < interval '7 days' then raise exception 'invalid_purge' using errcode = '22023'; end if;
  with d as (delete from app.copies where user_id = p_user and deleted_at is not null and deleted_at < cutoff returning rev) select coalesce(max(rev), 0), count(*) into m, c from d; top := greatest(top, m); total := total + c;
  with d as (delete from app.locations where user_id = p_user and deleted_at is not null and deleted_at < cutoff returning rev) select coalesce(max(rev), 0), count(*) into m, c from d; top := greatest(top, m); total := total + c;
  with d as (delete from app.pulls where user_id = p_user and deleted_at is not null and deleted_at < cutoff returning rev) select coalesce(max(rev), 0), count(*) into m, c from d; top := greatest(top, m); total := total + c;
  with d as (delete from app.series_follows where user_id = p_user and deleted_at is not null and deleted_at < cutoff returning rev) select coalesce(max(rev), 0), count(*) into m, c from d; top := greatest(top, m); total := total + c;
  with d as (delete from app.reading_progress where user_id = p_user and deleted_at is not null and deleted_at < cutoff returning rev) select coalesce(max(rev), 0), count(*) into m, c from d; top := greatest(top, m); total := total + c;
  with d as (delete from app.reading_states where user_id = p_user and deleted_at is not null and deleted_at < cutoff returning rev) select coalesce(max(rev), 0), count(*) into m, c from d; top := greatest(top, m); total := total + c;
  -- Un curseur inférieur à la dernière pierre tombale purgée n'a pas vu la suppression : resynchronisation complète exigée
  if top > 0 then update app.user_sync_state set purged_below_rev = greatest(purged_below_rev, top) where user_id = p_user; end if;
  delete from app.sync_ops where user_id = p_user and created_at < pg_catalog.now() - p_ops_older_than; get diagnostics ops = row_count;
  return pg_catalog.jsonb_build_object('purged', total, 'horizon', top, 'ops_purged', ops);
end;
$$;
revoke all on function app.purge_tombstones(uuid, interval, interval) from public, anon, authenticated;
