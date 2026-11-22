-- Migration 22 — Index des clés étrangères (D-117). Additive : crée seulement des index, ne touche à aucune donnée.
-- Les 32 clés étrangères signalées par le conseiller de performances Supabase le 22/11/2026 reçoivent un index,
-- pour que les suppressions en cascade (compte supprimé) et les jointures restent rapides quand la base se remplira.
-- Testée localement (PGlite) ; appliquée en préproduction le 22/11/2026 (D-117).

create index if not exists subscriptions_plan_fk on billing.subscriptions (plan);
create index if not exists banned_terms_created_by_fk on community.banned_terms (created_by);
create index if not exists live_hosts_invited_by_fk on community.live_hosts (invited_by);
create index if not exists live_messages_author_id_fk on community.live_messages (author_id);
create index if not exists live_votes_user_id_fk on community.live_votes (user_id);
create index if not exists moderation_log_moderator_id_fk on community.moderation_log (moderator_id);
create index if not exists comments_author_id_fk on forum.comments (author_id);
create index if not exists comments_parent_id_fk on forum.comments (parent_id);
create index if not exists side_votes_thread_id_fk on forum.side_votes (thread_id);
create index if not exists threads_author_id_fk on forum.threads (author_id);
create index if not exists age_reviews_decided_by_fk on guardian.age_reviews (decided_by);
create index if not exists events_actor_id_fk on guardian.events (actor_id);
create index if not exists events_user_id_fk on guardian.events (user_id);
create index if not exists links_guardian_id_fk on guardian.links (guardian_id);
create index if not exists links_revoked_by_fk on guardian.links (revoked_by);
create index if not exists restrictions_created_by_fk on guardian.restrictions (created_by);
create index if not exists settings_updated_by_fk on guardian.settings (updated_by);
create index if not exists favorites_listing_id_fk on market.favorites (listing_id);
create index if not exists listings_seller_id_fk on market.listings (seller_id);
create index if not exists offers_buyer_id_fk on market.offers (buyer_id);
create index if not exists order_events_actor_id_fk on market.order_events (actor_id);
create index if not exists order_events_order_id_fk on market.order_events (order_id);
create index if not exists orders_buyer_id_fk on market.orders (buyer_id);
create index if not exists orders_seller_id_fk on market.orders (seller_id);
create index if not exists reviews_reviewer_id_fk on market.reviews (reviewer_id);
create index if not exists conversations_b_fk on messaging.conversations (b);
create index if not exists messages_sender_id_fk on messaging.messages (sender_id);
create index if not exists reports_conversation_id_fk on messaging.reports (conversation_id);
create index if not exists reports_reporter_id_fk on messaging.reports (reporter_id);
create index if not exists applications_decided_by_fk on pro.applications (decided_by);
create index if not exists collabs_author_id_fk on pro.collabs (author_id);
create index if not exists profiles_verified_by_fk on pro.profiles (verified_by);
