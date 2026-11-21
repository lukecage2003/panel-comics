-- D-102 : modération plus rapide. Additive : une table, quatre fonctions ; rien n'est supprimé ni réécrit.
-- PRÉPARÉE, NON APPLIQUÉE : elle part avec l'ouverture des comptes (S8). Ne pas l'appliquer sans cette décision.
--   - mots interdits réglés par l'équipe (staff seulement) : un contenu qui en contient remonte dans la file, jamais retiré tout seul ;
--   - api.mod_queue2 : la file de la migration 13, avec un extrait du texte, l'auteur et le mot interdit trouvé, pour décider sans ouvrir chaque contenu ;
--   - api.mod_stats : délai médian de réponse sur 30 jours, nombre de signalements en retard selon la gravité.
-- api.mod_queue reste en place : rien de ce qui existe ne change de comportement.

create table community.banned_terms (
  term        text primary key check (char_length(term) between 2 and 40),
  created_by  uuid references community.members (user_id) on delete set null,
  created_at  timestamptz not null default now()
);
alter table community.banned_terms enable row level security;
revoke all on community.banned_terms from public, anon, authenticated;

-- Texte replié (minuscules, sans accents ni chiffres déguisés), comme moderation-core.js
create function community.fold_text(p text) returns text
language sql immutable set search_path = ''
as $$
  select ' ' || pg_catalog.btrim(pg_catalog.regexp_replace(pg_catalog.translate(pg_catalog.lower(coalesce(p, '')),
    'àâäáãåçéèêëíìîïñóòôöõúùûüýÿ@4310$57!|', 'aaaaaaceeeeiiiinooooouuuuyyaaeiosstii'), '[^a-z0-9]+', ' ', 'g')) || ' ';
$$;

create function api.mod_terms_get() returns jsonb
language plpgsql security definer set search_path = '' stable
as $$
begin
  if not community.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select pg_catalog.jsonb_agg(term order by term) from community.banned_terms), '[]'::jsonb);
end;
$$;

-- Remplace toute la liste (300 mots au plus) ; journalisé
create function api.mod_terms_set(p_terms text[]) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare n int;
begin
  if not community.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  if coalesce(pg_catalog.array_length(p_terms, 1), 0) > 300 then raise exception 'too_many' using errcode = '22023'; end if;
  delete from community.banned_terms;
  insert into community.banned_terms (term, created_by)
  select distinct pg_catalog.left(pg_catalog.btrim(t), 40), auth.uid() from pg_catalog.unnest(coalesce(p_terms, '{}')) t
  where pg_catalog.char_length(pg_catalog.btrim(t)) between 2 and 40
  on conflict do nothing;
  get diagnostics n = row_count;
  insert into community.moderation_log (moderator_id, target_kind, target_id, action, reason)
  values (auth.uid(), 'member', auth.uid(), 'warn', 'Liste des mots interdits mise à jour : ' || n || ' mot(s)');
  return pg_catalog.jsonb_build_object('status', 'saved', 'count', n);
end;
$$;

create function api.mod_queue2(p_limit int default 50) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if not community.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  return coalesce((select pg_catalog.jsonb_agg(x order by x.priority desc, (x.term_hit is not null) desc, x.reports desc, x.first_at) from (
    select r.target_kind, r.target_id, count(*)::int as reports, pg_catalog.array_agg(distinct r.reason) as reasons, min(r.created_at) as first_at,
      max(case when r.reason in ('minor_safety', 'self_harm') then 2 when r.reason in ('hate', 'harassment', 'sexual', 'violence') then 1 else 0 end) as priority,
      max(pg_catalog.left(p.body, 500)) as text, max(p.author_id::text) as author_id,
      (select b.term from community.banned_terms b where max(p.body) is not null and community.fold_text(max(p.body)) like '%' || community.fold_text(b.term) || '%' limit 1) as term_hit
    from community.reports r left join community.posts p on r.target_kind = 'post' and p.id = r.target_id
    where r.status = 'open' group by r.target_kind, r.target_id
    limit greatest(1, least(coalesce(p_limit, 50), 200))) x), '[]'::jsonb);
end;
$$;

-- Délais : médiane sur 30 jours (minutes) et signalements ouverts au-delà du délai visé (1 h, 4 h, 24 h selon la gravité)
create function api.mod_stats() returns jsonb
language plpgsql security definer set search_path = '' stable
as $$
begin
  if not community.is_staff() then raise exception 'forbidden' using errcode = '42501'; end if;
  return pg_catalog.jsonb_build_object(
    'median_min', (select pg_catalog.round(pg_catalog.percentile_cont(0.5) within group (order by extract(epoch from (resolved_at - created_at)) / 60)::numeric)
                   from community.reports where resolved_at is not null and resolved_at > now() - interval '30 days'),
    'late', (select count(*) from community.reports where status = 'open' and created_at < now() - case
               when reason in ('minor_safety', 'self_harm') then interval '1 hour'
               when reason in ('hate', 'harassment', 'sexual', 'violence') then interval '4 hours'
               else interval '24 hours' end));
end;
$$;

revoke all on function api.mod_terms_get(), api.mod_terms_set(text[]), api.mod_queue2(int), api.mod_stats(), community.fold_text(text) from public, anon;
grant execute on function api.mod_terms_get(), api.mod_terms_set(text[]), api.mod_queue2(int), api.mod_stats() to authenticated;
