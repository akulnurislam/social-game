export interface Battle {
  id: string;
  group_attacker: string;
  group_defender: string;
  state: string;
  meta: Record<string, any>;
  started_at: Date | null;
  finished_at: Date | null;
  created_at: Date;
}

export interface BattleMember {
  battle_id: string;
  player_id: string;
  role: string;
  joined_at: Date;
}
