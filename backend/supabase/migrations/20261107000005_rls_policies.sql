-- Lot 3.1 — Sécurité par ligne (RLS) : chaque utilisateur ne voit et ne modifie que ses propres lignes.
-- (select auth.uid()) est évalué une seule fois par requête (recommandation Supabase).
-- anon : aucun droit sur le schéma app.

-- 1. RLS activée sur toutes les tables du schéma app.
alter table app.profiles          enable row level security;
alter table app.user_settings     enable row level security;
alter table app.devices           enable row level security;
alter table app.copies            enable row level security;
alter table app.locations         enable row level security;
alter table app.pulls             enable row level security;
alter table app.series_follows    enable row level security;
alter table app.reading_progress  enable row level security;
alter table app.user_sync_state   enable row level security;
alter table app.sync_ops          enable row level security;
alter table app.sync_conflicts    enable row level security;

-- 2. Droits de base : rien pour anon ni public ; authenticated limité par les politiques.
revoke all on all tables in schema app from public;
revoke all on all tables in schema app from anon;

grant select, insert, update, delete on
  app.profiles, app.user_settings, app.devices,
  app.copies, app.locations, app.pulls, app.series_follows, app.reading_progress
  to authenticated;
grant select on app.user_sync_state, app.sync_ops, app.sync_conflicts to authenticated;

-- 3. Politiques par opération pour les tables personnelles.
do $$
declare t text;
begin
  foreach t in array array['profiles', 'user_settings', 'devices', 'copies', 'locations', 'pulls', 'series_follows', 'reading_progress'] loop
    execute format('create policy %I on app.%I for select to authenticated using ((select auth.uid()) = user_id)', t || '_select_own', t);
    execute format('create policy %I on app.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t || '_insert_own', t);
    execute format('create policy %I on app.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t || '_update_own', t);
    execute format('create policy %I on app.%I for delete to authenticated using ((select auth.uid()) = user_id)', t || '_delete_own', t);
  end loop;
end $$;

-- 4. Tables techniques : lecture seule de ses propres lignes.
create policy user_sync_state_select_own on app.user_sync_state for select to authenticated using ((select auth.uid()) = user_id);
create policy sync_ops_select_own        on app.sync_ops        for select to authenticated using ((select auth.uid()) = user_id);
create policy sync_conflicts_select_own  on app.sync_conflicts  for select to authenticated using ((select auth.uid()) = user_id);
