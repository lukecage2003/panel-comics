-- Lot 3.1 — Tables personnelles synchronisables (colonnes communes : docs/phase3/04-synchronisation.md § 2).
-- Clé primaire (user_id, id) : les identifiants clients (s_…, loc_…, pl_…) sont conservés sans collision entre utilisateurs.

-- Exemplaires (physicalSingles, wishlist incluse) — domaine Collection
create table app.copies (
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
  series_key        text,
  issue_number      text,
  is_wishlist       boolean not null default false,
  constraint copies_pkey primary key (user_id, id),
  constraint copies_id_check check (char_length(id) between 1 and 100),
  constraint copies_data_size check (octet_length(data::text) <= 65536),
  constraint copies_schema_version_check check (schema_version >= 1)
);
create index copies_user_rev_idx on app.copies (user_id, rev);

-- Emplacements (locDoc.nodes) — domaine Collection
create table app.locations (
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
  parent_id         text,
  kind              text,
  constraint locations_pkey primary key (user_id, id),
  constraint locations_id_check check (char_length(id) between 1 and 100),
  constraint locations_data_size check (octet_length(data::text) <= 65536),
  constraint locations_schema_version_check check (schema_version >= 1)
);
create index locations_user_rev_idx on app.locations (user_id, rev);

-- Pull List par numéro — domaine Collection (D-09 : la Pull List appartient à Collection)
create table app.pulls (
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
  series_key        text,
  release_date      date,
  constraint pulls_pkey primary key (user_id, id),
  constraint pulls_id_check check (char_length(id) between 1 and 100),
  constraint pulls_data_size check (octet_length(data::text) <= 65536),
  constraint pulls_schema_version_check check (schema_version >= 1)
);
create index pulls_user_rev_idx on app.pulls (user_id, rev);

-- Séries suivies (seriesMeta) — domaine Collection
create table app.series_follows (
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
  constraint series_follows_pkey primary key (user_id, id),
  constraint series_follows_id_check check (char_length(id) between 1 and 100),
  constraint series_follows_data_size check (octet_length(data::text) <= 65536),
  constraint series_follows_schema_version_check check (schema_version >= 1)
);
create index series_follows_user_rev_idx on app.series_follows (user_id, rev);

-- Progression de lecture (readprog) — domaine Lecture
create table app.reading_progress (
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
  guide_id          text,
  entry_id          text,
  constraint reading_progress_pkey primary key (user_id, id),
  constraint reading_progress_id_check check (char_length(id) between 1 and 100),
  constraint reading_progress_data_size check (octet_length(data::text) <= 65536),
  constraint reading_progress_schema_version_check check (schema_version >= 1)
);
create index reading_progress_user_rev_idx on app.reading_progress (user_id, rev);
create index copies_user_series_idx on app.copies (user_id, series_key);
create index pulls_user_release_idx on app.pulls (user_id, release_date);
