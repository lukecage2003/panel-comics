-- D-123 : pensées plus longues. Une pensée, une théorie ou une question peut faire 2 000 caractères (comme la colonne
-- community.posts.body, déjà limitée à 2 000). Seule la limite change ; droits et contrôles restent identiques.
create or replace function api.note_create(p_note_kind text, p_body text, p_tags text[], p_issue jsonb, p_visibility text, p_spoiler boolean default false) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare pid uuid; b text; t text; n int := 0; pay jsonb;
begin
  if not community.member_active(auth.uid()) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_note_kind not in ('thought', 'theory', 'question') or p_visibility not in ('public', 'followers', 'private') then raise exception 'invalid_post' using errcode = '22023'; end if;
  b := pg_catalog.btrim(pg_catalog.regexp_replace(coalesce(p_body, ''), '[\x00-\x08\x0B\x0C\x0E-\x1F]', '', 'g'));
  if b = '' then raise exception 'empty' using errcode = '22023'; end if;
  if char_length(b) > 2000 then raise exception 'too_long' using errcode = '22001'; end if;
  if b ~ '<[A-Za-z!/]' then raise exception 'markup_refused' using errcode = '22023'; end if;
  pay := pg_catalog.jsonb_build_object('note', p_note_kind, 'verdict', case when p_note_kind = 'theory' then 'open' else '' end);
  if p_issue is not null and pg_catalog.jsonb_typeof(p_issue) = 'object' and coalesce(p_issue ->> 'series', '') <> '' then
    pay := pay || pg_catalog.jsonb_build_object('issue', pg_catalog.jsonb_build_object(
      'series', pg_catalog.left(p_issue ->> 'series', 120), 'issue', pg_catalog.left(coalesce(p_issue ->> 'issue', ''), 20), 'publisher', pg_catalog.left(coalesce(p_issue ->> 'publisher', ''), 100)));
  end if;
  perform community.rate_check('post');
  insert into community.posts (author_id, kind, body, payload, visibility, spoiler)
  values (auth.uid(), 'note', b, pay, p_visibility, coalesce(p_spoiler, false)) returning id into pid;
  -- Mots-dièse : seulement ceux réellement écrits dans le texte, dix au plus
  foreach t in array coalesce(p_tags, '{}'::text[]) loop
    exit when n >= 10;
    t := pg_catalog.btrim(t);
    if char_length(t) between 2 and 30 and t !~ '[[:space:]#<>@/\\]' and pg_catalog.strpos(pg_catalog.lower(b), '#' || pg_catalog.lower(t)) > 0 then
      insert into community.post_tags (post_id, tag) values (pid, t) on conflict do nothing;
      if found then n := n + 1; end if;
    end if;
  end loop;
  return pid;
end;
$$;
