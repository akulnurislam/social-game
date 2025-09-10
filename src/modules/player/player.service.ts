import type { Player } from './player';
import type { PlayerRepository } from './player.repository';

export class PlayerService {
  constructor(private repo: PlayerRepository) { }

  async createPlayer(username: string): Promise<Player | null> {
    // TODO: Add validation
    return this.repo.create(username);
  }

  async getPlayerById(id: string): Promise<Player | null> {
    return this.repo.findById(id);
  }
}