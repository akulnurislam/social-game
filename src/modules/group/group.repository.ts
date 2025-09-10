import type { Pool } from 'pg';
import type { Group, GroupMember } from './group';

export class GroupRepository {
  constructor(private pool: Pool) { }

  async create(name: string, ownerId: string, meta: any = {}): Promise<Group | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // create group
      const groupResult = await client.query<Group>(
        `INSERT INTO groups (name, owner, meta)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [name, ownerId, meta]
      );
      const group = groupResult.rows[0] ?? null;

      // auto add owner to group_members if owner exists
      if (group && ownerId) {
        await client.query(
          `INSERT INTO group_members (group_id, player_id, role)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [group.id, ownerId, 'owner']
        );
      }

      await client.query('COMMIT');
      return group;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findAll(limit = 20, offset = 0): Promise<Group[]> {
    const result = await this.pool.query<Group>(
      `SELECT id, name, owner, meta, created_at
       FROM groups
       ORDER BY created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return result.rows;
  }

  async findById(id: string): Promise<Group | null> {
    const result = await this.pool.query<Group>(
      `SELECT id, name, owner, meta, created_at
       FROM groups WHERE id = $1`,
      [id]
    );
    return result.rows[0] ?? null;
  }

  async listMembers(groupId: string): Promise<GroupMember[]> {
    const result = await this.pool.query(
      `SELECT player_id, role, joined_at FROM group_members WHERE group_id = $1 ORDER BY joined_at ASC`,
      [groupId]
    );
    return result.rows;
  }

  async joinGroup(groupId: string, playerId: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO group_members (group_id, player_id, role)
       VALUES ($1, $2, 'member')
       ON CONFLICT DO NOTHING`,
      [groupId, playerId]
    );
  }

  async leaveGroup(groupId: string, playerId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM group_members WHERE group_id = $1 AND player_id = $2`,
      [groupId, playerId]
    );
  }
}
