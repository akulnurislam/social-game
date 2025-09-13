import type { Leaderboard } from './leaderboard';
import type { LeaderboardRepository } from './leaderboard.repository';

export class LeaderboardService {
  constructor(private readonly repo: LeaderboardRepository) { }

  async upsertLeaderboard(groupId: string, score: number) {
    const entry = {
      groupId: groupId,
      score,
      updated: new Date(),
    };
    return this.repo.upsert(entry);
  }

  async getTop(limit = 10): Promise<Leaderboard[]> {
    return this.repo.getTop(limit);
  }

  async listLeaderboards(limit = 20, offset = 0): Promise<Leaderboard[]> {
    return this.repo.findAll(limit, offset);
  }
}
