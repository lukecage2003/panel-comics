-- Lot 3.5 (local, D-43) — Résolution des conflits consignés par api.sync_push. Migration additive : fonctions seulement.
--   api.list_conflicts(open_only)          : conflits de l'utilisateur connecté (ouverts par défaut), du plus récent au plus ancien.
--   api.resolve_conflict(device, id, choix): applique la valeur choisie (« local » ou « server ») au champ, par une écriture serveur
--                                            ordinaire (nouvelle révision, field_revs à jour) ; la valeur écartée reste dans le conflit.
--                                            Réversible : un conflit déjà résolu peut l'être de nouveau avec l'autre choix.
--   Cas « __deleted » (suppression contre modification) : « local » rejoue l'intention de l'appareil (supprimer ou garder),
--   « server » rétablit l'état du serveur au moment du conflit.

create function api.list_conflicts(p_open_only boolean default true) returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', c.id, 'entity', c.entity, 'entity_id', c.entity_id, 'field', c.field,
    'local_value', c.local_value, 'server_value', c.server_value, 'base_rev', c.base_rev, 'server_rev', c.server_rev, 'created_at', c.created_at,
    'resolved_at', c.resolved_at, 'resolution', c.resolution) order by c.created_at desc), '[]'::jsonb)
  from app.sync_conflicts c
  where c.user_id = auth.uid() and (not coalesce(p_open_only, true) or c.resolved_at is null);
$$;
revoke all on function api.list_conflicts(boolean) from public, anon;
grant execute on function api.list_conflicts(boolean) to authenticated;

create function api.resolve_conflict(p_device uuid, p_id uuid, p_choice text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  c record; val jsonb; want_deleted boolean; nrev bigint; cur_del timestamptz; found_row boolean;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  perform app.active_device(p_device);
  if p_choice is null or p_choice not in ('local', 'server') then raise exception 'invalid_choice' using errcode = '22023'; end if;
  select * into c from app.sync_conflicts where id = p_id and user_id = uid for update;
  if not found then raise exception 'unknown_conflict' using errcode = '22023'; end if;
  if c.entity not in ('copies', 'locations', 'pulls', 'series_follows', 'reading_progress', 'reading_states') then raise exception 'invalid_entity' using errcode = '22023'; end if;
  val := case when p_choice = 'local' then c.local_value else c.server_value end;
  execute pg_catalog.format('select deleted_at, true from app.%I where user_id = $1 and id = $2 for update', c.entity) into cur_del, found_row using uid, c.entity_id;
  if not coalesce(found_row, false) then raise exception 'unknown_row' using errcode = '22023'; end if;
  if c.field = '__deleted' then
    want_deleted := case pg_catalog.jsonb_typeof(val) when 'boolean' then (val)::text::boolean when 'string' then true else false end;
    if want_deleted and cur_del is null then
      execute pg_catalog.format('update app.%I set deleted_at = pg_catalog.now(), updated_by_device = $3 where user_id = $1 and id = $2 returning rev', c.entity) into nrev using uid, c.entity_id, p_device;
    elsif not want_deleted and cur_del is not null then
      execute pg_catalog.format('update app.%I set deleted_at = null, updated_by_device = $3 where user_id = $1 and id = $2 returning rev', c.entity) into nrev using uid, c.entity_id, p_device;
    end if;
  else
    if c.field is null or c.field = '' then raise exception 'invalid_conflict' using errcode = '22023'; end if;
    execute pg_catalog.format('update app.%I set data = data || pg_catalog.jsonb_build_object($3::text, $4::jsonb), updated_by_device = $5 where user_id = $1 and id = $2 and (data -> $3) is distinct from $4::jsonb returning rev', c.entity)
      into nrev using uid, c.entity_id, c.field, val, p_device;
  end if;
  update app.sync_conflicts set resolved_at = pg_catalog.now(), resolution = 'chose_' || p_choice where id = c.id;
  return pg_catalog.jsonb_build_object('status', 'resolved', 'choice', p_choice, 'rev', nrev, 'changed', nrev is not null);
end;
$$;
revoke all on function api.resolve_conflict(uuid, uuid, text) from public, anon;
grant execute on function api.resolve_conflict(uuid, uuid, text) to authenticated;
