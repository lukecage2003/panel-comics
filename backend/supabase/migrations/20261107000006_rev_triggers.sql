-- Lot 3.1 — Révision serveur (rev) monotone par utilisateur, et horodatage updated_at.

-- rev : tirée de user_sync_state.last_rev + 1 (verrou de ligne implicite par l'upsert).
-- security definer : l'utilisateur n'a pas le droit d'écrire dans user_sync_state ; search_path vide contre le détournement.
create function app.assign_rev() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_rev bigint;
begin
  insert into app.user_sync_state as s (user_id, last_rev)
  values (new.user_id, 1)
  on conflict (user_id) do update set last_rev = s.last_rev + 1
  returning s.last_rev into next_rev;
  new.rev := next_rev;
  return new;
end;
$$;
revoke all on function app.assign_rev() from public;

create function app.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;  -- created_at ne se réécrit pas
  end if;
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;
revoke all on function app.touch_updated_at() from public;

do $$
declare t text;
begin
  -- Tables synchronisées : rev + updated_at
  foreach t in array array['copies', 'locations', 'pulls', 'series_follows', 'reading_progress'] loop
    execute format('create trigger %I before insert or update on app.%I for each row execute function app.assign_rev()', t || '_assign_rev', t);
    execute format('create trigger %I before insert or update on app.%I for each row execute function app.touch_updated_at()', t || '_touch_updated_at', t);
  end loop;
end $$;

-- user_settings : rev + updated_at (pas de created_at)
create function app.touch_settings_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;
revoke all on function app.touch_settings_updated_at() from public;

create trigger user_settings_assign_rev before insert or update on app.user_settings
  for each row execute function app.assign_rev();
create trigger user_settings_touch_updated_at before insert or update on app.user_settings
  for each row execute function app.touch_settings_updated_at();

-- profiles : updated_at seulement (non synchronisé par rev)
create trigger profiles_touch_updated_at before insert or update on app.profiles
  for each row execute function app.touch_updated_at();
