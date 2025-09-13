import type { Pool } from 'pg';
import type { Battle, BattleMember } from './battle';

export class BattleRepository {
  constructor(private readonly pool: Pool) { }

  async createBattle(groupAttacker: string, groupDefender: string, meta: any = {}): Promise<Battle | null> {
    const result = await this.pool.query<Battle>(
      `INSERT INTO battles (group_attacker, group_defender, meta)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [groupAttacker, groupDefender, meta]
    );
    return result.rows[0] ?? null;
  }

  async findById(battleId: string): Promise<Battle | null> {
    const result = await this.pool.query<Battle>(`SELECT * FROM battles WHERE id = $1`, [battleId]);
    return result.rows[0] ?? null;
  }

  async updateState(battleId: string, state: string, timestamps: { started?: Date; finished?: Date }): Promise<Battle | null> {
    const result = await this.pool.query<Battle>(
      `UPDATE battles
       SET state = $2,
           started_at = COALESCE($3, started_at),
           finished_at = COALESCE($4, finished_at)
       WHERE id = $1
       RETURNING *`,
      [battleId, state, timestamps.started || null, timestamps.finished || null]
    );
    return result.rows[0] ?? null;
  }

  async addMember(battleId: string, playerId: string, role: string): Promise<BattleMember | null> {
    const result = await this.pool.query<BattleMember>(
      `INSERT INTO battle_members (battle_id, player_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (battle_id, player_id) DO NOTHING
       RETURNING *`,
      [battleId, playerId, role]
    );
    return result.rows[0] ?? null;
  }

  async listMembers(battleId: string): Promise<BattleMember[]> {
    const result = await this.pool.query<BattleMember>(`SELECT * FROM battle_members WHERE battle_id = $1`, [battleId]);
    return result.rows;
  }
}
