export interface Group {
  id: string;
  name: string;
  owner: string | null;
  meta: Record<string, any>;
  created_at: Date;
}

export interface GroupMember {
  group_id: string;
  player_id: string;
  role: string;
  joined_at: Date;
}
