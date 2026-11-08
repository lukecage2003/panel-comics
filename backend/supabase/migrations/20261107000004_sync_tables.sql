-- Lot 3.1 — Tables techniques de synchronisation (utilisées par sync_push / sync_pull au lot 3.4).
-- Lecture seule pour l'utilisateur : l'écriture passera par des fonctions serveur.

-- Compteur de révision par utilisateur (ordre total des écritures d'un utilisateur).
create table app.user_sync_state (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  last_rev bigint not null default 0 check (last_rev >= 0)
);

-- Idempotence des opérations envoyées par les appareils (rétention prévue : 90 jours).
create table app.sync_ops (
  user_id     uuid not null references auth.users (id) on delete cascade,
  op_id       uuid not null,
  applied_rev bigint,
  result      jsonb,
  created_at  timestamptz not null default now(),
  constraint sync_ops_pkey primary key (user_id, op_id)
);
create index sync_ops_created_at_idx on app.sync_ops (created_at);

-- Conflits : aucune valeur perdante n'est jetée.
create table app.sync_conflicts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  entity       text not null,
  entity_id    text not null check (char_length(entity_id) between 1 and 100),
  field        text,
  local_value  jsonb,
  server_value jsonb,
  base_rev     bigint,
  server_rev   bigint,
  device_id    uuid,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolution   text
);
create index sync_conflicts_user_resolved_idx on app.sync_conflicts (user_id, resolved_at);
