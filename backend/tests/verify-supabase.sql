-- Vérification du schéma app après application des migrations.
-- Utilisable tel quel sur une base Supabase LOCALE (Docker) :
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f backend/tests/verify-supabase.sql
-- Exécuté aussi dans PGlite par migrations.test.js. Lecture seule : ne modifie rien. Lève une erreur au premier écart.
do $$
declare
  n int;
  expected text[] := array['copies','devices','locations','profiles','pulls','reading_progress','reading_states','series_follows','sync_conflicts','sync_ops','user_settings','user_sync_state'];
  got text[];
begin
  select array_agg(relname::text order by relname) into got from pg_class where relnamespace = 'app'::regnamespace and relkind = 'r';
  if got is distinct from expected then raise exception 'Tables app inattendues : %', got; end if;

  select count(*) into n from pg_class where relnamespace = 'app'::regnamespace and relkind = 'r' and not relrowsecurity;
  if n <> 0 then raise exception 'RLS désactivée sur % table(s)', n; end if;

  select count(*) into n from pg_policies where schemaname = 'app';
  if n <> 36 then raise exception 'Nombre de politiques : % (36 attendues : 8 tables x 4 + 3 lectures + reading_states en lecture)', n; end if;

  select count(*) into n from pg_policies where schemaname = 'app' and not (roles @> array['authenticated']::name[]);
  if n <> 0 then raise exception '% politique(s) ne visent pas authenticated', n; end if;

  select count(*) into n from pg_class c where c.relnamespace = 'app'::regnamespace and c.relkind = 'r'
    and has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate,references,trigger');
  if n <> 0 then raise exception 'anon a des droits sur % table(s)', n; end if;

  select count(*) into n from pg_class c where c.relnamespace = 'app'::regnamespace
    and c.relname in ('user_sync_state','sync_ops','sync_conflicts')
    and has_table_privilege('authenticated', c.oid, 'insert,update,delete');
  if n <> 0 then raise exception 'authenticated peut écrire dans % table(s) technique(s)', n; end if;

  if has_column_privilege('authenticated', 'app.devices', 'revoked_at', 'update')
     or has_column_privilege('authenticated', 'app.devices', 'last_sync_rev', 'update') then
    raise exception 'revoked_at ou last_sync_rev modifiable par authenticated';
  end if;

  select count(*) into n from pg_proc where pronamespace = 'app'::regnamespace
    and (has_function_privilege('anon', oid, 'execute') or has_function_privilege('authenticated', oid, 'execute'));
  if n <> 0 then raise exception '% fonction(s) app exécutable(s) par un client', n; end if;

  select count(*) into n from pg_proc where pronamespace = 'app'::regnamespace and proname = 'assign_rev'
    and prosecdef and proconfig @> array['search_path=""'];
  if n <> 1 then raise exception 'assign_rev doit être security definer avec search_path vide'; end if;

  select count(*) into n from pg_constraint where connamespace = 'app'::regnamespace and contype = 'f' and confdeltype <> 'c';
  if n <> 0 then raise exception '% clé(s) étrangère(s) sans cascade', n; end if;

  -- Lot 3.4 (migration 8, D-31) : écritures des tables synchronisées seulement par api.sync_push
  select count(*) into n from pg_class c where c.relnamespace = 'app'::regnamespace
    and c.relname in ('copies','locations','pulls','series_follows','reading_progress','reading_states')
    and has_table_privilege('authenticated', c.oid, 'insert,update,delete');
  if n <> 0 then raise exception 'authenticated peut écrire directement dans % table(s) synchronisée(s)', n; end if;
  select count(*) into n from pg_proc where pronamespace = 'api'::regnamespace and proname in ('sync_push','sync_pull')
    and prosecdef and proconfig @> array['search_path=""'] and not has_function_privilege('anon', oid, 'execute') and has_function_privilege('authenticated', oid, 'execute');
  if n <> 2 then raise exception 'api.sync_push et api.sync_pull : security definer, search_path vide, authenticated seulement'; end if;

  -- Lot 3.6 (migration 9, D-35) : export et effacement pour authenticated seulement ; purge réservée au service
  select count(*) into n from pg_proc where pronamespace = 'api'::regnamespace and proname in ('export_my_data','delete_my_data')
    and prosecdef and proconfig @> array['search_path=""'] and not has_function_privilege('anon', oid, 'execute') and has_function_privilege('authenticated', oid, 'execute');
  if n <> 2 then raise exception 'api.export_my_data et api.delete_my_data : security definer, search_path vide, authenticated seulement'; end if;
  select count(*) into n from pg_proc where pronamespace = 'app'::regnamespace and proname = 'purge_tombstones' and (has_function_privilege('authenticated', oid, 'execute') or has_function_privilege('anon', oid, 'execute'));
  if n <> 0 then raise exception 'app.purge_tombstones ne doit être exécutable par aucun client'; end if;

  select count(*) into n from pg_namespace where nspname in ('catalog','editorial','media','signals','community');
  if n <> 0 then raise exception 'Schéma réservé créé'; end if;

  raise notice 'verify-supabase : schéma app conforme (12 tables, 36 politiques, RLS 100 %%, anon sans droit, écritures par api.sync_push).';
end $$;
