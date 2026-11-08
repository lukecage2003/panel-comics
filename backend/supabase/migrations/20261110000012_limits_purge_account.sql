-- Lot 3.6 (local, D-45) — Migration additive : limitation de débit des écritures, purge planifiable, suppression de compte.
--   app.service_limits                : réglages réservés au service (aucun accès client).
--   Limitation de débit               : déclencheur d'instruction sur app.sync_ops ; au-delà de « sync_ops_per_minute » opérations
--                                       par utilisateur sur 60 secondes, le lot entier est refusé (rate_limited, 53400), rien n'est écrit.
--                                       Une limite du fournisseur (passerelle d'API) reste à configurer sur le projet réel (3.2).
--   app.purge_due(âge)                : purge des pierres tombales de tous les comptes concernés (service seulement) ; destinée à une
--                                       tâche planifiée (pg_cron ou Edge Function) qui n'est PAS activée ici.
--   app.delete_account(user)          : suppression complète d'un compte (service seulement) ; les données personnelles partent par
--                                       les clés étrangères « on delete cascade ». Sur Supabase, l'Edge Function delete-account passe
--                                       par l'API d'administration (auth.admin.deleteUser), qui produit le même effet.

create table app.service_limits (
  key        text primary key check (key ~ '^[a-z_]{1,64}$'),
  value      bigint not null check (value > 0),
  updated_at timestamptz not null default now()
);
alter table app.service_limits enable row level security;
revoke all on app.service_limits from public, anon, authenticated;
insert into app.service_limits (key, value) values ('sync_ops_per_minute', 3000);

create index sync_ops_user_created_idx on app.sync_ops (user_id, created_at);

create function app.enforce_sync_rate() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lim bigint;
  over_user uuid;
begin
  select value into lim from app.service_limits where key = 'sync_ops_per_minute';
  if lim is null then return null; end if;
  select n.user_id into over_user
  from (select distinct user_id from newrows) n
  where (select count(*) from app.sync_ops o where o.user_id = n.user_id and o.created_at > pg_catalog.now() - interval '60 seconds') > lim
  limit 1;
  if over_user is not null then raise exception 'rate_limited' using errcode = '53400'; end if;
  return null;
end;
$$;
revoke all on function app.enforce_sync_rate() from public, anon, authenticated;
create trigger sync_ops_rate after insert on app.sync_ops referencing new table as newrows for each statement execute function app.enforce_sync_rate();

create function app.purge_due(p_older_than interval default interval '90 days') returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid; r jsonb; users int := 0; total bigint := 0; ops bigint := 0;
begin
  if p_older_than is null or p_older_than < interval '7 days' then raise exception 'invalid_purge' using errcode = '22023'; end if;
  for u in select user_id from app.user_sync_state order by user_id loop
    r := app.purge_tombstones(u, p_older_than);
    if (r ->> 'purged')::int > 0 or (r ->> 'ops_purged')::int > 0 then users := users + 1; end if;
    total := total + (r ->> 'purged')::int; ops := ops + (r ->> 'ops_purged')::int;
  end loop;
  return pg_catalog.jsonb_build_object('users', users, 'purged', total, 'ops_purged', ops);
end;
$$;
revoke all on function app.purge_due(interval) from public, anon, authenticated;

create function app.delete_account(p_user uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare c int;
begin
  if p_user is null then raise exception 'invalid_user' using errcode = '22023'; end if;
  delete from auth.users where id = p_user; get diagnostics c = row_count;
  if c = 0 then raise exception 'unknown_user' using errcode = '22023'; end if;
  return pg_catalog.jsonb_build_object('status', 'account_deleted');
end;
$$;
revoke all on function app.delete_account(uuid) from public, anon, authenticated;
