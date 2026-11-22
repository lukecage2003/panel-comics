-- D-115 : suivi des ventes du Marché (numéro de suivi, retard d'expédition, litige motivé), baisses de prix des favoris.
-- Migration additive : colonnes facultatives, nouvelles fonctions, une fonction remplacée à signature identique
-- (api.favorites_mine). Aucune donnée existante n'est modifiée ni supprimée. Testée localement (PGlite) ;
-- APPLIQUÉE EN PRÉPRODUCTION le 22/11/2026 (D-116), comptes en ligne (S8) toujours fermés.
-- Ajoute aussi la limite « guardian_code » (10 essais par heure), absente jusque-là : sans ligne, rate_check ne limitait rien.

insert into community.limits (action, max_count, per_seconds) values ('dispute', 5, 86400), ('guardian_code', 10, 3600) on conflict do nothing;

alter table market.orders
  add column if not exists tracking text check (tracking is null or tracking ~ '^[A-Z0-9]{8,40}$'),
  add column if not exists dispute_reason text check (dispute_reason is null or dispute_reason in ('not_received', 'not_as_described', 'damaged', 'counterfeit', 'other')),
  add column if not exists dispute_body text check (dispute_body is null or char_length(dispute_body) between 20 and 1000),
  add column if not exists dispute_photos smallint not null default 0 check (dispute_photos between 0 and 6);

-- Prix au moment de l'ajout aux favoris : sert à prévenir d'une baisse
alter table market.favorites add column if not exists saved_price_cents int check (saved_price_cents is null or saved_price_cents > 0);
create function market.favorite_price() returns trigger
language plpgsql security definer set search_path = ''
as $$ begin
  if new.saved_price_cents is null then select l.price_cents into new.saved_price_cents from market.listings l where l.id = new.listing_id; end if;
  return new;
end $$;
revoke all on function market.favorite_price() from public, anon, authenticated;
create trigger favorites_price before insert on market.favorites for each row execute function market.favorite_price();

-- Date du premier passage d'une vente dans un état (journal des étapes)
create function market.reached_at(p_order uuid, p_state text) returns timestamptz
language sql security definer set search_path = '' stable
as $$ select min(e.at) from market.order_events e where e.order_id = p_order and e.to_state = p_state; $$;
revoke all on function market.reached_at(uuid, text) from public, anon, authenticated;

-- Expédition avec numéro de suivi (vendeur)
create function api.order_ship(p_order uuid, p_tracking text) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare o market.orders; t text := upper(pg_catalog.regexp_replace(coalesce(p_tracking, ''), '[\s.-]', '', 'g'));
begin
  select * into o from market.orders where id = p_order and seller_id = auth.uid() for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if t !~ '^[A-Z0-9]{8,40}$' then raise exception 'invalid_tracking' using errcode = '22023'; end if;
  update market.orders set tracking = t where id = o.id;
  return api.order_step(p_order, 'ship');
end $$;

-- Annulation par l'acheteur quand le vendeur n'a pas expédié 5 jours après le paiement
create function api.order_cancel_late(p_order uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare o market.orders; paid timestamptz;
begin
  select * into o from market.orders where id = p_order and buyer_id = auth.uid() for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  paid := market.reached_at(o.id, 'paid');
  if o.state <> 'paid' or o.delivery = 'hand' or paid is null then raise exception 'invalid_transition' using errcode = '22023'; end if;
  if paid + interval '5 days' > now() then raise exception 'not_late_yet' using errcode = '22023'; end if;
  update market.orders set state = 'cancelled', updated_at = now() where id = o.id;
  update market.listings set status = 'listed' where id = o.listing_id and status = 'reserved';
  insert into market.order_events (order_id, actor_id, action, from_state, to_state) values (o.id, auth.uid(), 'late_cancel', 'paid', 'cancelled');
  return pg_catalog.jsonb_build_object('state', 'cancelled');
end $$;

-- Litige motivé : en route, ou dans les 3 jours après la livraison ; photo exigée pour les motifs qui portent sur l'exemplaire
create function api.order_dispute(p_order uuid, p_reason text, p_body text, p_photos int default 0) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare o market.orders; delivered timestamptz; b text := pg_catalog.btrim(coalesce(p_body, ''));
begin
  select * into o from market.orders where id = p_order and buyer_id = auth.uid() for update;
  if not found then raise exception 'not_found' using errcode = 'P0002'; end if;
  if p_reason is null or p_reason not in ('not_received', 'not_as_described', 'damaged', 'counterfeit', 'other') then raise exception 'invalid_reason' using errcode = '22023'; end if;
  if char_length(b) < 20 or char_length(b) > 1000 then raise exception 'invalid_body' using errcode = '22023'; end if;
  if p_reason in ('not_as_described', 'damaged', 'counterfeit') and coalesce(p_photos, 0) < 1 then raise exception 'photo_required' using errcode = '22023'; end if;
  delivered := market.reached_at(o.id, 'delivered');
  if o.state = 'delivered' and delivered is not null and delivered + interval '3 days' < now() then raise exception 'dispute_window_closed' using errcode = '22023'; end if;
  perform community.rate_check('dispute');
  update market.orders set dispute_reason = p_reason, dispute_body = b, dispute_photos = least(greatest(coalesce(p_photos, 0), 0), 6) where id = o.id;
  return api.order_step(p_order, 'dispute');
end $$;

-- Mes ventes et mes achats, avec le journal des étapes (pour la frise côté application)
create function api.orders_mine() returns jsonb
language sql security definer set search_path = '' stable
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', o.id, 'role', case when o.buyer_id = auth.uid() then 'buyer' else 'seller' end,
    'state', o.state, 'delivery', o.delivery, 'price_cents', o.price_cents, 'fee_cents', case when o.seller_id = auth.uid() then o.fee_cents end,
    'tracking', o.tracking, 'title', l.title, 'issue', l.issue, 'dispute_reason', o.dispute_reason,
    'events', (select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('to', e.to_state, 'at', e.at) order by e.at), '[]'::jsonb) from market.order_events e where e.order_id = o.id))
    order by o.created_at desc), '[]'::jsonb)
  from market.orders o join market.listings l on l.id = o.listing_id
  where o.buyer_id = auth.uid() or o.seller_id = auth.uid();
$$;

-- Favoris : avec le prix d'ajout, pour signaler une baisse (signature inchangée)
create or replace function api.favorites_mine() returns jsonb
language sql security definer set search_path = '' stable
as $$
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id', l.id, 'title', l.title, 'issue', l.issue, 'price_cents', l.price_cents, 'currency', l.currency,
    'status', l.status, 'saved_price_cents', f.saved_price_cents,
    'drop_pct', case when f.saved_price_cents > l.price_cents then pg_catalog.round((1 - l.price_cents::numeric / f.saved_price_cents) * 100)::int else 0 end) order by f.created_at desc), '[]'::jsonb)
  from market.favorites f join market.listings l on l.id = f.listing_id
  where f.user_id = auth.uid() and l.status in ('listed', 'reserved') and forum.sees(auth.uid(), l.seller_id);
$$;

revoke all on function api.order_ship(uuid, text), api.order_cancel_late(uuid), api.order_dispute(uuid, text, text, int), api.orders_mine() from public, anon;
grant execute on function api.order_ship(uuid, text), api.order_cancel_late(uuid), api.order_dispute(uuid, text, text, int), api.orders_mine() to authenticated;
