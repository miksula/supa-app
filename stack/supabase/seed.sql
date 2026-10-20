-- Local development seed. Runs on `supabase db reset` (see [db.seed] in
-- config.toml); never applied to hosted projects.

-- PowerSync connects as powersync_role locally (PS_DATA_SOURCE_URI in
-- stack/powersync/docker/.env). Dev-only password.
alter role powersync_role with login password 'powersync_local';

-- Dev user: dev@example.com / password123
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values (
  '00000000-0000-0000-0000-000000000000',
  'd0d0d0d0-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'dev@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}', '{}',
  now(), now(),
  '', '', '', ''
);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data,
  last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(),
  'd0d0d0d0-0000-4000-8000-000000000001',
  'd0d0d0d0-0000-4000-8000-000000000001',
  'email',
  jsonb_build_object(
    'sub', 'd0d0d0d0-0000-4000-8000-000000000001',
    'email', 'dev@example.com',
    'email_verified', true
  ),
  now(), now(), now()
);

-- Sample data
insert into public.lists (id, name, owner_id) values
  ('11111111-0000-4000-8000-000000000001', 'Groceries', 'd0d0d0d0-0000-4000-8000-000000000001'),
  ('11111111-0000-4000-8000-000000000002', 'Work', 'd0d0d0d0-0000-4000-8000-000000000001');

insert into public.todos (description, list_id, created_by, completed, completed_at, completed_by) values
  ('Milk', '11111111-0000-4000-8000-000000000001', 'd0d0d0d0-0000-4000-8000-000000000001', false, null, null),
  ('Bread', '11111111-0000-4000-8000-000000000001', 'd0d0d0d0-0000-4000-8000-000000000001', true, now(), 'd0d0d0d0-0000-4000-8000-000000000001'),
  ('Review pull requests', '11111111-0000-4000-8000-000000000002', 'd0d0d0d0-0000-4000-8000-000000000001', false, null, null);
