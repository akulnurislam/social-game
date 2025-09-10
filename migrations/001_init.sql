CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Players
CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  username text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index to quickly lookup by username
CREATE INDEX IF NOT EXISTS idx_players_username ON players (username);

-- Groups
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  owner uuid REFERENCES players(id) ON DELETE SET NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Index to lookup by owner
CREATE INDEX IF NOT EXISTS idx_groups_owner ON groups (owner);

-- Group Members
CREATE TABLE IF NOT EXISTS group_members (
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (group_id, player_id)
);

-- Indexes for quick membership lookups
CREATE INDEX IF NOT EXISTS idx_group_members_player_id ON group_members (player_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members (group_id);

-- Battles
CREATE TABLE IF NOT EXISTS battles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_attacker uuid REFERENCES groups(id) ON DELETE CASCADE,
  group_defender uuid REFERENCES groups(id) ON DELETE CASCADE,
  state text DEFAULT 'pending', -- pending | running | finished
  meta jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Tracks which players joined a battle
CREATE TABLE IF NOT EXISTS battle_members (
  battle_id uuid REFERENCES battles(id) ON DELETE CASCADE,
  player_id uuid REFERENCES players(id) ON DELETE CASCADE,
  role text DEFAULT 'participant', -- could be attacker/defender/observer
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (battle_id, player_id)
);

-- Indexes for battle queries
CREATE INDEX IF NOT EXISTS idx_battles_group_attacker ON battles (group_attacker);
CREATE INDEX IF NOT EXISTS idx_battles_group_defender ON battles (group_defender);

-- Combined index for queries filtering both group and state
CREATE INDEX IF NOT EXISTS idx_battles_group_state
  ON battles(state, group_attacker, group_defender);

-- For sorting/filtering by state and time
CREATE INDEX IF NOT EXISTS idx_battles_state_created ON battles(state, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_battles_state_started ON battles(state, started_at DESC);

-- Efficient listing of members per battle
CREATE INDEX IF NOT EXISTS idx_battle_members_battle ON battle_members(battle_id);

-- Efficient lookup of player participation across battles
CREATE INDEX IF NOT EXISTS idx_battle_members_player ON battle_members(player_id);

-- Leaderboard
CREATE TABLE IF NOT EXISTS leaderboard (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  score bigint DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

-- Unique leaderboard entry per group
CREATE UNIQUE INDEX IF NOT EXISTS idx_leaderboard_group_id ON leaderboard (group_id);

-- Index for ordering leaderboard by score
CREATE INDEX IF NOT EXISTS idx_leaderboard_score_desc ON leaderboard (score DESC);

-- Index for fast recency queries
CREATE INDEX IF NOT EXISTS idx_leaderboard_updated_at ON leaderboard (updated_at);
