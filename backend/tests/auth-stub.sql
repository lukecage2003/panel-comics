-- Schéma auth MINIMAL, pour les tests seulement (Supabase fournit le vrai schéma auth).
-- Ne jamais placer ce fichier dans supabase/migrations.

create role anon nologin noinherit;
create role authenticated nologin noinherit;

create schema auth;
create table auth.users (
  id         uuid primary key default gen_random_uuid(),
  email      text,
  created_at timestamptz not null default now()
);

-- Même logique que Supabase : le sujet du jeton (claim « sub »).
create function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

-- Jeton complet (Supabase : auth.jwt()) ; ici reconstitué à partir des réglages du test (sub, aal).
create function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb)
    || jsonb_strip_nulls(jsonb_build_object('sub', nullif(current_setting('request.jwt.claim.sub', true), ''), 'aal', nullif(current_setting('request.jwt.claim.aal', true), '')))
$$;

grant usage on schema auth to anon, authenticated;
grant execute on function auth.jwt() to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
