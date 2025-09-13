import { PlayerNotFoundException } from '../../exceptions/player-not-found-exception';
import type { Player } from './player';
import type { PlayerRepository } from './player.repository';

export class PlayerService {
  constructor(private readonly repo: PlayerRepository) { }

  async createPlayer(username: string, telegramId: number): Promise<Player | null> {
    return this.repo.create(username, telegramId);
  }

  async getPlayerById(playerId: string): Promise<Player> {
    const player = await this.repo.findById(playerId);
    if (!player) {
      throw new PlayerNotFoundException(playerId);
    }

    return player;
  }

  getPlayerByTelegramId(telegramId: number): Promise<Player | null> {
    return this.repo.findByTelegramId(telegramId);
  }
}
