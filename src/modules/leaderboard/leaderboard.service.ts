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

  async getLeaderboard(limit = 10) {
    return this.repo.getTop(limit);
  }
}
