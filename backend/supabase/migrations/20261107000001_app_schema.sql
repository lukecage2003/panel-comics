-- Lot 3.1 — Schéma personnel « app » (données personnelles uniquement).
-- Les schémas catalog, editorial, media, signals (Explorer 2.0) et community sont réservés et NE sont PAS créés ici.
-- Le schéma « auth » (auth.users, auth.uid()) est fourni par Supabase ; en test, par backend/tests/auth-stub.sql.

create schema if not exists extensions;
create extension if not exists citext with schema extensions;

create schema if not exists app;
comment on schema app is 'Panel : données personnelles (Collection, Lecture, préférences). Jamais lu par Explorer ni Community.';

revoke all on schema app from public;
revoke all on schema app from anon;
grant usage on schema app to authenticated;
grant usage on schema extensions to authenticated;
