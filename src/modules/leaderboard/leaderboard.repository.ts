import type { Pool } from 'pg';
import type { Leaderboard } from './leaderboard';

export class LeaderboardRepository {
  constructor(private readonly pool: Pool) { }

  async upsert(entry: { groupId: string; score: number; updated: Date }): Promise<Leaderboard | null> {
    const result = await this.pool.query<Leaderboard>(
      `
      INSERT INTO leaderboard (group_id, score, updated_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (group_id)
      DO UPDATE SET score = leaderboard.score + EXCLUDED.score,
                    updated_at = EXCLUDED.updated_at
      RETURNING *;
      `,
      [entry.groupId, entry.score, entry.updated],
    );
    return result.rows[0] ?? null;
  }

  async getTop(limit: number = 10): Promise<Leaderboard[]> {
    const result = await this.pool.query<Leaderboard>(
      `
      SELECT * FROM leaderboard
      ORDER BY score DESC, updated_at DESC
      LIMIT $1;
      `,
      [limit],
    );
    return result.rows;
  }
}
