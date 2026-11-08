-- Données de test FICTIVES uniquement (aucune donnée personnelle réelle).
-- En local avec Supabase CLI (`supabase db reset`), auth.users est géré par la plateforme :
-- ces lignes y créent deux utilisateurs de démonstration.

insert into auth.users (id, email) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'demo-a@exemple.test'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'demo-b@exemple.test')
on conflict (id) do nothing;

insert into app.profiles (user_id, handle, display_name) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'demo_a', 'Démo A'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'demo_b', 'Démo B')
on conflict (user_id) do nothing;

insert into app.copies (user_id, id, data, series_key, issue_number) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 's_demo_1', '{"series": "Série fictive", "issue": "1"}', 'serie-fictive', '1'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 's_demo_1', '{"series": "Autre série fictive", "issue": "2"}', 'autre-serie-fictive', '2')
on conflict (user_id, id) do nothing;
