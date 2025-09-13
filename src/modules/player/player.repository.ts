import type { Pool } from 'pg';
import type { Player } from './player';

export class PlayerRepository {
  constructor(private readonly pool: Pool) { }

  async create(username: string, telegramId: number): Promise<Player | null> {
    const result = await this.pool.query<Player>(
      `INSERT INTO players (username, telegram_id)
       VALUES ($1, $2)
       RETURNING *`,
      [username, telegramId]
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

  async findByTelegramId(telegramId: number): Promise<Player | null> {
    const result = await this.pool.query<Player>(
      `SELECT * FROM players WHERE telegram_id = $1`,
      [telegramId]
    );
    return result.rows[0] ?? null;
  }
}
