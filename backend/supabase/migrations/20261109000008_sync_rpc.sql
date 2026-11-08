-- Lot 3.4 (local, D-31) — Synchronisation : fonctions sync_push / sync_pull, révisions par champ, état de lecture par œuvre (L1).
-- Migration additive : les migrations 1 à 7 ne sont pas modifiées. Aucune donnée n'est supprimée ; aucune synchronisation réelle n'est activée.
--   T1 : écritures par api.sync_push (security definer) seulement ; droits INSERT/UPDATE/DELETE directs retirés sur les tables synchronisées.
--   T2 : suppression = pierre tombale (deleted_at) ; aucune suppression physique par un client.
--   T3 : UPDATE … RETURNING, puis INSERT si aucune ligne.
--   T4 : app.skip_rev (session) pour les migrations de données du service ; ignorée pour les rôles clients.

-- Schéma des fonctions appelables par le client (le schéma app reste sans fonction exécutable par un client).
create schema api;
revoke all on schema api from public;
grant usage on schema api to authenticated;

-- L1 (D-30) : état de lecture par œuvre (ReadingState), clé de l'œuvre dans id (pub:… ou loc:…).
create table app.reading_states (
  user_id           uuid not null references auth.users (id) on delete cascade default auth.uid(),
  id                text not null,
  data              jsonb not null default '{}'::jsonb,
  field_revs        jsonb not null default '{}'::jsonb,
  rev               bigint not null default 0,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  updated_by_device uuid,
  schema_version    smallint not null default 1,
  constraint reading_states_pkey primary key (user_id, id),
  constraint reading_states_id_check check (char_length(id) between 1 and 400),
  constraint reading_states_data_size check (octet_length(data::text) <= 65536),
  constraint reading_states_field_revs_size check (octet_length(field_revs::text) <= 16384),
  constraint reading_states_schema_version_check check (schema_version >= 1)
);
create index reading_states_user_rev_idx on app.reading_states (user_id, rev);
alter table app.reading_states enable row level security;
revoke all on app.reading_states from public, anon;
grant select on app.reading_states to authenticated;
create policy reading_states_select_own on app.reading_states for select to authenticated using ((select auth.uid()) = user_id);

-- Horizon de purge (lot 3.6) : un curseur plus ancien exige une resynchronisation complète. Aucune purge n'est réalisée ici.
alter table app.user_sync_state add column purged_below_rev bigint not null default 0;
alter table app.user_sync_state add constraint user_sync_state_purged_check check (purged_below_rev >= 0);

-- T4 : révision serveur, sauf migration de données du service (app.skip_rev = 'on', jamais pour anon ou authenticated).
create or replace function app.assign_rev() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_rev bigint;
begin
  if coalesce(pg_catalog.current_setting('app.skip_rev', true), '') = 'on'
     and coalesce(pg_catalog.current_setting('role', true), 'none') not in ('anon', 'authenticated') then
    if tg_op = 'UPDATE' then new.rev := old.rev; end if;
    return new;
  end if;
  insert into app.user_sync_state as s (user_id, last_rev)
  values (new.user_id, 1)
  on conflict (user_id) do update set last_rev = s.last_rev + 1
  returning s.last_rev into next_rev;
  new.rev := next_rev;
  return new;
end;
$$;
revoke all on function app.assign_rev() from public, anon, authenticated;

-- Révision par champ : chaque clé de data modifiée reçoit la révision de l'écriture (base de la fusion par champ, lot 3.5).
create function app.stamp_field_revs() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.field_revs := coalesce((select pg_catalog.jsonb_object_agg(k, new.rev) from pg_catalog.jsonb_object_keys(new.data) k), '{}'::jsonb);
  elsif new.rev is distinct from old.rev then
    new.field_revs := old.field_revs
      || coalesce((select pg_catalog.jsonb_object_agg(k, new.rev) from pg_catalog.jsonb_object_keys(new.data) k where (new.data -> k) is distinct from (old.data -> k)), '{}'::jsonb)
      || coalesce((select pg_catalog.jsonb_object_agg(k, new.rev) from pg_catalog.jsonb_object_keys(old.data) k where not (new.data ? k)), '{}'::jsonb);
  end if;
  return new;
end;
$$;
revoke all on function app.stamp_field_revs() from public, anon, authenticated;

do $$
declare t text;
begin
  execute 'create trigger reading_states_assign_rev before insert or update on app.reading_states for each row execute function app.assign_rev()';
  execute 'create trigger reading_states_touch_updated_at before insert or update on app.reading_states for each row execute function app.touch_updated_at()';
  -- Ordre des déclencheurs BEFORE (alphabétique) : assign_rev, stamp_field_revs, touch_updated_at
  foreach t in array array['copies', 'locations', 'pulls', 'series_follows', 'reading_progress', 'reading_states'] loop
    execute format('create trigger %I before insert or update on app.%I for each row execute function app.stamp_field_revs()', t || '_stamp_field_revs', t);
  end loop;
  -- T1 et T2 : plus d'écriture ni de suppression directe par le client sur les tables synchronisées
  foreach t in array array['copies', 'locations', 'pulls', 'series_follows', 'reading_progress'] loop
    execute format('revoke insert, update, delete on app.%I from authenticated', t);
  end loop;
end $$;

-- sync_push : au plus 200 opérations, une transaction, tout ou rien.
-- Op : {op_id uuid, entity, id, kind: upsert|delete, base_rev, patch, schema_version}
-- Résultat par op : {op_id, status: applied|duplicate|merged|conflict, rev, conflicts, server_row?}
-- Règles (lot 3.5, docs/phase3/04 § 4 et 10 § 5) :
--   - fusion par champ : un champ modifié sur le serveur après base_rev et différent garde la valeur du serveur (premier écrit gagnant) ; conflit consigné, rien n'est jeté ;
--   - une valeur null concurrente ne remplace jamais une valeur connue (même règle : conflit consigné) ;
--   - champs inconnus du client : conservés (data || patch) ;
--   - suppression contre modification : la modification gagne, la suppression est consignée ; modification d'une pierre tombale : résurrection consignée.
create function api.sync_push(p_device uuid, p_ops jsonb, p_confirm_mass_delete boolean default false) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  op jsonb; prev jsonb; r jsonb; results jsonb := '[]'::jsonb;
  ent text; rid text; kind text; base bigint; patch jsonb; sv int; oid uuid;
  cdata jsonb; cfr jsonb; crev bigint; cdel timestamptz; found_row boolean;
  k text; v jsonb; apply jsonb; nconf int; nrev bigint; status text; ndel int;
  ents constant text[] := array['copies', 'locations', 'pulls', 'series_follows', 'reading_progress', 'reading_states'];
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_device is null or not exists (select 1 from app.devices d where d.id = p_device and d.user_id = uid and d.revoked_at is null) then
    raise exception 'device_revoked_or_unknown' using errcode = '42501';
  end if;
  if p_ops is null or pg_catalog.jsonb_typeof(p_ops) <> 'array' or pg_catalog.jsonb_array_length(p_ops) > 200 then
    raise exception 'invalid_batch' using errcode = '22023';
  end if;
  -- Validation complète avant toute écriture (tout ou rien)
  for op in select e from pg_catalog.jsonb_array_elements(p_ops) e loop
    if pg_catalog.jsonb_typeof(op) <> 'object'
       or coalesce(op ->> 'op_id', '') !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
       or not ((op ->> 'entity') = any (ents))
       or pg_catalog.char_length(coalesce(op ->> 'id', '')) not between 1 and (case when op ->> 'entity' = 'reading_states' then 400 else 100 end)
       or coalesce(op ->> 'kind', '') not in ('upsert', 'delete')
       or coalesce(op ->> 'base_rev', '0') !~ '^[0-9]{1,18}$'
       or coalesce(op ->> 'schema_version', '1') !~ '^[0-9]{1,4}$' or coalesce((op ->> 'schema_version')::int, 1) < 1
       or (op ->> 'kind' = 'upsert' and (pg_catalog.jsonb_typeof(op -> 'patch') is distinct from 'object' or pg_catalog.octet_length((op -> 'patch')::text) > 65536)) then
      raise exception 'invalid_op' using errcode = '22023', detail = pg_catalog.left(op::text, 200);
    end if;
  end loop;
  -- Garde-fou anti-cataclysme : plus de 50 suppressions dans un lot exigent une confirmation explicite
  select pg_catalog.count(*) into ndel from pg_catalog.jsonb_array_elements(p_ops) e where e ->> 'kind' = 'delete';
  if ndel > 50 and not coalesce(p_confirm_mass_delete, false) then
    return pg_catalog.jsonb_build_object('status', 'needs_confirmation', 'deletes', ndel);
  end if;
  -- Ordre de validation = ordre des révisions : verrou de la ligne de compteur de l'utilisateur
  insert into app.user_sync_state (user_id, last_rev) values (uid, 0) on conflict (user_id) do nothing;
  perform 1 from app.user_sync_state s where s.user_id = uid for update;

  for op in select e from pg_catalog.jsonb_array_elements(p_ops) e loop
    oid := (op ->> 'op_id')::uuid;
    -- Idempotence : un op_id rejoué renvoie le résultat enregistré, sans nouvelle révision
    select s.result into prev from app.sync_ops s where s.user_id = uid and s.op_id = oid;
    if found then
      results := results || pg_catalog.jsonb_build_array(prev || pg_catalog.jsonb_build_object('status', 'duplicate', 'original_status', prev ->> 'status'));
      continue;
    end if;
    ent := op ->> 'entity'; rid := op ->> 'id'; kind := op ->> 'kind';
    base := coalesce((op ->> 'base_rev')::bigint, 0); patch := coalesce(op -> 'patch', '{}'::jsonb);
    sv := coalesce((op ->> 'schema_version')::int, 1);
    nconf := 0; nrev := null;
    execute pg_catalog.format('select data, field_revs, rev, deleted_at, true from app.%I where user_id = $1 and id = $2 for update', ent)
      into cdata, cfr, crev, cdel, found_row using uid, rid;
    found_row := coalesce(found_row, false);
    if kind = 'upsert' then
      if not found_row then
        execute pg_catalog.format('insert into app.%I (user_id, id, data, updated_by_device, schema_version) values ($1, $2, $3, $4, $5) returning rev', ent)
          into nrev using uid, rid, patch, p_device, sv;
        status := 'applied';
      else
        apply := '{}'::jsonb;
        for k, v in select * from pg_catalog.jsonb_each(patch) loop
          if coalesce((cfr ->> k)::bigint, 0) > base and (cdata -> k) is distinct from v then
            insert into app.sync_conflicts (user_id, entity, entity_id, field, local_value, server_value, base_rev, server_rev, device_id)
              values (uid, ent, rid, k, v, cdata -> k, base, crev, p_device);
            nconf := nconf + 1;
          else
            apply := apply || pg_catalog.jsonb_build_object(k, v);
          end if;
        end loop;
        if cdel is not null then
          -- Modification d'une pierre tombale : la modification gagne (résurrection), la suppression reste consignée
          insert into app.sync_conflicts (user_id, entity, entity_id, field, local_value, server_value, base_rev, server_rev, device_id, resolution)
            values (uid, ent, rid, '__deleted', 'false'::jsonb, pg_catalog.to_jsonb(cdel), base, crev, p_device, 'resurrected');
        end if;
        if apply <> '{}'::jsonb or cdel is not null then
          execute pg_catalog.format('update app.%I set data = data || $3, deleted_at = null, updated_by_device = $4, schema_version = greatest(schema_version, $5) where user_id = $1 and id = $2 returning rev', ent)
            into nrev using uid, rid, apply, p_device, sv;
        else
          nrev := crev;
        end if;
        status := case when nconf > 0 then 'conflict' when crev > base then 'merged' else 'applied' end;
      end if;
    else -- delete : pierre tombale seulement
      if not found_row then
        status := 'applied';
      elsif cdel is not null then
        status := 'applied'; nrev := crev;
      elsif crev > base then
        -- Suppression contre modification concurrente : la modification gagne, la suppression est consignée
        insert into app.sync_conflicts (user_id, entity, entity_id, field, local_value, server_value, base_rev, server_rev, device_id, resolution)
          values (uid, ent, rid, '__deleted', 'true'::jsonb, 'false'::jsonb, base, crev, p_device, 'modification_kept');
        nconf := 1; nrev := crev; status := 'conflict';
      else
        execute pg_catalog.format('update app.%I set deleted_at = pg_catalog.now(), updated_by_device = $3 where user_id = $1 and id = $2 returning rev', ent)
          into nrev using uid, rid, p_device;
        status := 'applied';
      end if;
    end if;
    r := pg_catalog.jsonb_build_object('op_id', oid, 'status', status, 'rev', nrev, 'conflicts', nconf);
    if status in ('merged', 'conflict') then
      execute pg_catalog.format('select pg_catalog.jsonb_build_object(''data'', data, ''field_revs'', field_revs, ''rev'', rev, ''deleted_at'', deleted_at) from app.%I where user_id = $1 and id = $2', ent)
        into v using uid, rid;
      r := r || pg_catalog.jsonb_build_object('server_row', v);
    end if;
    insert into app.sync_ops (user_id, op_id, applied_rev, result) values (uid, oid, nrev, r);
    results := results || pg_catalog.jsonb_build_array(r);
  end loop;
  update app.devices d set last_sync_rev = (select s.last_rev from app.user_sync_state s where s.user_id = uid), last_seen_at = pg_catalog.now() where d.id = p_device;
  return pg_catalog.jsonb_build_object('status', 'ok', 'results', results);
end;
$$;
revoke all on function api.sync_push(uuid, jsonb, boolean) from public, anon;
grant execute on function api.sync_push(uuid, jsonb, boolean) to authenticated;

-- sync_pull : lignes de rev > p_since, triées par rev, pierres tombales comprises, pagination par curseur.
create function api.sync_pull(p_since bigint, p_max int default 500) returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  uid uuid := auth.uid();
  horizon bigint; lim int; rws jsonb; n int; nxt bigint;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_since is null or p_since < 0 then raise exception 'invalid_cursor' using errcode = '22023'; end if;
  select s.purged_below_rev into horizon from app.user_sync_state s where s.user_id = uid;
  if p_since < coalesce(horizon, 0) then
    return pg_catalog.jsonb_build_object('status', 'resync_required', 'horizon', horizon);
  end if;
  lim := least(greatest(coalesce(p_max, 500), 1), 1000);
  with u as (
    select 'copies' as entity, id, data, field_revs, rev, deleted_at, schema_version from app.copies where user_id = uid and rev > p_since
    union all select 'locations', id, data, field_revs, rev, deleted_at, schema_version from app.locations where user_id = uid and rev > p_since
    union all select 'pulls', id, data, field_revs, rev, deleted_at, schema_version from app.pulls where user_id = uid and rev > p_since
    union all select 'series_follows', id, data, field_revs, rev, deleted_at, schema_version from app.series_follows where user_id = uid and rev > p_since
    union all select 'reading_progress', id, data, field_revs, rev, deleted_at, schema_version from app.reading_progress where user_id = uid and rev > p_since
    union all select 'reading_states', id, data, field_revs, rev, deleted_at, schema_version from app.reading_states where user_id = uid and rev > p_since
  ), page as (select * from u order by rev limit lim + 1)
  select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(page) order by rev), pg_catalog.count(*) into rws, n from page;
  rws := coalesce(rws, '[]'::jsonb);
  if n > lim then rws := rws - lim; end if;
  nxt := case when pg_catalog.jsonb_array_length(rws) > 0 then (rws -> (pg_catalog.jsonb_array_length(rws) - 1) ->> 'rev')::bigint else p_since end;
  return pg_catalog.jsonb_build_object('status', 'ok', 'rows', rws, 'next_rev', nxt, 'has_more', n > lim);
end;
$$;
revoke all on function api.sync_pull(bigint, int) from public, anon;
grant execute on function api.sync_pull(bigint, int) to authenticated;
