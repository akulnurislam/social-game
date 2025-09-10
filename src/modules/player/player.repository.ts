import type { Pool } from 'pg';
import type { Player } from './player';

export class PlayerRepository {
  constructor(private pool: Pool) { }

  async create(username: string): Promise<Player | null> {
    const result = await this.pool.query<Player>(
      `INSERT INTO players (username) 
       VALUES ($1) 
       RETURNING id, username, created_at`,
      [username]
    );
    return result.rows[0] ?? null;
  }

  async findById(id: string): Promise<Player | null> {
    const result = await this.pool.query<Player>(
      `SELECT id, username, created_at FROM players WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }
}
