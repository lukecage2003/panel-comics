-- Lot 3.1 — Profil, préférences, appareils.

create table app.profiles (
  user_id          uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  handle           extensions.citext unique,
  display_name     text check (display_name is null or char_length(display_name) <= 80),
  avatar_path      text check (avatar_path is null or char_length(avatar_path) <= 300),
  bio              text check (bio is null or char_length(bio) <= 1000),
  locale           text not null default 'fr',
  preferred_market text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint profiles_handle_format check (handle is null or handle::text ~ '^[A-Za-z0-9_.-]{3,30}$')
);

create table app.user_settings (
  user_id       uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  prefs         jsonb not null default '{}'::jsonb,
  notifications jsonb not null default '{}'::jsonb,
  -- Privé par défaut : rien n'est public tant que l'utilisateur ne l'a pas choisi.
  privacy       jsonb not null default '{"profile_public": false}'::jsonb,
  rev           bigint not null default 0,
  updated_at    timestamptz not null default now(),
  constraint user_settings_size check (octet_length(prefs::text) + octet_length(notifications::text) + octet_length(privacy::text) <= 65536)
);

create table app.devices (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade default auth.uid(),
  label         text check (label is null or char_length(label) <= 80),
  platform      text not null check (platform in ('web', 'android')),
  app_version   text,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz,
  last_sync_rev bigint not null default 0,
  revoked_at    timestamptz
);
create index devices_user_id_idx on app.devices (user_id);
