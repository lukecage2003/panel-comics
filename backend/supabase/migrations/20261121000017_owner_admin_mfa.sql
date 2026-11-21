-- D-104 — Administrateur général (propriétaire) et double authentification obligatoire pour l'équipe.
-- Migration ADDITIVE, préparée, NON appliquée : à appliquer avec l'ouverture des comptes (S8), avec les migrations 14 à 16.
--
-- Principes :
--   - aucun mot de passe, code ni identifiant d'administrateur dans l'application ni dans ce dépôt ;
--   - le rôle « owner » (administrateur général) ne s'attribue QUE côté serveur (rôle service, éditeur SQL de Supabase),
--     jamais depuis l'application ; il ne peut pas être donné ni retiré par l'interface ;
--   - toute action d'équipe (propriétaire, administrateur, modérateur) exige une session en double authentification
--     (Supabase Auth MFA, niveau « aal2 » : application d'authentification TOTP) ; sans elle, l'équipe n'a aucun pouvoir ;
--   - l'équipe ne lit jamais les données personnelles (collection, finances, notes privées) : les règles RLS restent inchangées ;
--   - chaque changement de rôle est journalisé (qui, quoi, quand, pourquoi).
-- Rien n'est supprimé : contrainte de rôle élargie, fonctions remplacées à l'identique en plus strict, nouvelles fonctions.

-- ── Rôle « owner » ──────────────────────────────────────────────────────────────────────────────────
alter table app.staff_roles drop constraint if exists staff_roles_role_check;
alter table app.staff_roles add constraint staff_roles_role_check check (role in ('owner', 'admin', 'editor', 'moderator'));

create or replace function app.grant_role(p_user uuid, p_role text, p_actor text, p_reason text default null) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare c int;
begin
  if p_user is null or p_role is null or p_role not in ('owner', 'admin', 'editor', 'moderator') or coalesce(p_actor, '') = '' then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  insert into app.staff_roles (user_id, role, granted_by) values (p_user, p_role, p_actor) on conflict do nothing;
  get diagnostics c = row_count;
  if c > 0 then insert into app.staff_role_log (user_id, role, action, actor, reason) values (p_user, p_role, 'grant', p_actor, p_reason); end if;
  return pg_catalog.jsonb_build_object('status', case when c > 0 then 'granted' else 'unchanged' end);
end;
$$;
revoke all on function app.grant_role(uuid, text, text, text) from public, anon, authenticated;

-- ── Double authentification ─────────────────────────────────────────────────────────────────────────
-- Niveau d'assurance de la session (claim « aal » du jeton Supabase) : « aal2 » après la saisie du code à usage unique.
create function app.mfa_ok() returns boolean
language sql
stable
set search_path = ''
as $$ select coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'; $$;
revoke all on function app.mfa_ok() from public, anon, authenticated; -- appelée seulement par les fonctions du serveur

-- Rôle d'équipe effectif : attribué ET session en double authentification
create function app.staff_ok(p_role text) returns boolean
language sql
security definer
set search_path = ''
stable
as $$ select app.mfa_ok() and app.has_role(p_role); $$;
revoke all on function app.staff_ok(text) from public, anon, authenticated;

-- La modération (migrations 13 à 16) passe par community.is_staff() : désormais double authentification obligatoire,
-- et le propriétaire en fait partie.
create or replace function community.is_staff() returns boolean
language sql security definer set search_path = '' stable
as $$ select app.mfa_ok() and (app.has_role('moderator') or app.has_role('admin') or app.has_role('owner')); $$;

-- ── Console d'administration (propriétaire et administrateurs, en double authentification) ────────────
-- Ce que la session peut faire : rôles attribués et état de la double authentification (rien de secret).
create function api.my_access() returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select pg_catalog.jsonb_build_object(
    'roles', coalesce((select pg_catalog.jsonb_agg(r.role order by r.role) from app.staff_roles r where r.user_id = auth.uid()), '[]'::jsonb),
    'mfa', app.mfa_ok());
$$;
revoke all on function api.my_access() from public, anon;
grant execute on function api.my_access() to authenticated;

-- Vue d'ensemble : uniquement des comptes agrégés, aucune donnée personnelle
create function api.admin_overview() returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not (app.staff_ok('owner') or app.staff_ok('admin')) then raise exception 'forbidden' using errcode = '42501'; end if;
  return pg_catalog.jsonb_build_object(
    'members', (select count(*) from community.members),
    'members_active', (select count(*) from community.members m where m.status = 'active'),
    'members_suspended', (select count(*) from community.members m where m.status = 'suspended'),
    'posts', (select count(*) from community.posts),
    'posts_hidden', (select count(*) from community.posts p where p.status <> 'visible'),
    'reports_open', (select count(*) from community.reports r where r.status = 'open'),
    'staff', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('user_id', s.user_id, 'role', s.role, 'since', s.granted_at) order by s.role, s.granted_at), '[]'::jsonb) from app.staff_roles s)
  );
end;
$$;
revoke all on function api.admin_overview() from public, anon;
grant execute on function api.admin_overview() to authenticated;

-- Attribuer ou retirer un rôle d'équipe : propriétaire seulement, jamais « owner », jamais sur soi-même, motif obligatoire
create function api.admin_set_role(p_user uuid, p_role text, p_grant boolean, p_reason text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare actor text;
begin
  if not app.staff_ok('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_role is null or p_role not in ('admin', 'editor', 'moderator') then raise exception 'invalid_role' using errcode = '22023'; end if;
  if p_user is null or p_user = auth.uid() then raise exception 'invalid_target' using errcode = '22023'; end if;
  if coalesce(pg_catalog.btrim(p_reason), '') = '' or pg_catalog.length(p_reason) > 500 then raise exception 'reason_required' using errcode = '22023'; end if;
  actor := 'owner:' || auth.uid()::text;
  if p_grant then return app.grant_role(p_user, p_role, actor, p_reason); end if;
  return app.revoke_role(p_user, p_role, actor, p_reason);
end;
$$;
revoke all on function api.admin_set_role(uuid, text, boolean, text) from public, anon;
grant execute on function api.admin_set_role(uuid, text, boolean, text) to authenticated;

-- Journal des rôles : propriétaire seulement
create function api.admin_role_log(p_limit int default 100) returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if not app.staff_ok('owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  return (select coalesce(pg_catalog.jsonb_agg(x order by x.at desc), '[]'::jsonb) from (
    select l.user_id, l.role, l.action, l.actor, l.reason, l.created_at as at from app.staff_role_log l
    order by l.created_at desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) x);
end;
$$;
revoke all on function api.admin_role_log(int) from public, anon;
grant execute on function api.admin_role_log(int) to authenticated;
