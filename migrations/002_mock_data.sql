-- Insert mock players
INSERT INTO players (id, telegram_id, username) VALUES
  ('11111111-1111-1111-1111-111111111111', 10001, 'PlayerA'),
  ('22222222-2222-2222-2222-222222222222', 10002, 'PlayerB'),
  ('33333333-3333-3333-3333-333333333333', 10003, 'PlayerC'),
  ('44444444-4444-4444-4444-444444444444', 10004, 'PlayerD')
ON CONFLICT (id) DO NOTHING;

-- Insert mock groups
INSERT INTO groups (id, name, owner) VALUES
  ('aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Group A', '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Group B', '22222222-2222-2222-2222-222222222222')
ON CONFLICT (id) DO NOTHING;

-- Add owners as members of their groups
INSERT INTO group_members (group_id, player_id, role) VALUES
  ('aaaaaaa1-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('bbbbbbb2-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner')
ON CONFLICT (group_id, player_id) DO NOTHING;
