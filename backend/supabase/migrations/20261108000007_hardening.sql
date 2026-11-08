-- Lot 3.1 — Durcissement après l'audit de clôture (8 novembre 2026). Migration additive : les migrations 1 à 6 ne sont pas modifiées.
-- Défauts démontrés par backend/tests/hardening.test.js :
--   D1. un utilisateur pouvait annuler la révocation de son appareil (revoked_at) et falsifier last_sync_rev ;
--   D2. field_revs n'était pas borné (2 Mo acceptés), ce qui contournait la limite de 64 Ko par ligne ;
--   D3. les colonnes extraites n'étaient pas bornées (seule l'erreur d'index de PostgreSQL arrêtait series_key).

-- D1 : revoked_at et last_sync_rev sont réservés au serveur (fonctions du lot 3.4, service).
revoke insert, update on app.devices from authenticated;
grant insert (id, user_id, label, platform, app_version, last_seen_at) on app.devices to authenticated;
grant update (label, app_version, last_seen_at) on app.devices to authenticated;
alter table app.devices
  add constraint devices_app_version_len check (app_version is null or char_length(app_version) <= 40);

-- D2 : field_revs ≤ 16 Ko sur toutes les tables synchronisées.
do $$
declare t text;
begin
  foreach t in array array['copies', 'locations', 'pulls', 'series_follows', 'reading_progress'] loop
    execute format('alter table app.%I add constraint %I check (octet_length(field_revs::text) <= 16384)', t, t || '_field_revs_size');
  end loop;
end $$;

-- D3 : colonnes extraites bornées.
alter table app.copies
  add constraint copies_series_key_len check (series_key is null or char_length(series_key) <= 300),
  add constraint copies_issue_number_len check (issue_number is null or char_length(issue_number) <= 50);
alter table app.locations
  add constraint locations_parent_id_len check (parent_id is null or char_length(parent_id) <= 100),
  add constraint locations_kind_len check (kind is null or char_length(kind) <= 40);
alter table app.pulls
  add constraint pulls_series_key_len check (series_key is null or char_length(series_key) <= 300);
alter table app.reading_progress
  add constraint reading_progress_guide_id_len check (guide_id is null or char_length(guide_id) <= 100),
  add constraint reading_progress_entry_id_len check (entry_id is null or char_length(entry_id) <= 100);

-- Défense en profondeur : les fonctions de déclencheur ne sont exécutables par aucun rôle client,
-- même si une plateforme accorde des droits par défaut à anon ou authenticated.
revoke all on function app.assign_rev() from anon, authenticated;
revoke all on function app.touch_updated_at() from anon, authenticated;
revoke all on function app.touch_settings_updated_at() from anon, authenticated;
