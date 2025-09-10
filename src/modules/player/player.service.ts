import { PlayerNotFoundException } from '../../exceptions/player-not-found-exception';
import type { Player } from './player';
import type { PlayerRepository } from './player.repository';

export class PlayerService {
  constructor(private repo: PlayerRepository) { }

  async createPlayer(username: string): Promise<Player | null> {
    // TODO: Add validation
    return this.repo.create(username);
  }

  async getPlayerById(playerId: string): Promise<Player> {
    const player = await this.repo.findById(playerId);
    if (!player) {
      throw new PlayerNotFoundException(playerId);
    }

    return player;
  }
}
