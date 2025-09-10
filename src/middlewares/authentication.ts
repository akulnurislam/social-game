import type { NextFunction, Request, Response } from 'express';
import validator from 'validator';
import { pool } from '../core/db';
import { PlayerNotFoundException } from '../exceptions/player-not-found-exception';
import { UnauthorizedException } from '../exceptions/unauthorized-exception';
import { PlayerRepository } from '../modules/player/player.repository';
import { PlayerService } from '../modules/player/player.service';

const playerRepository = new PlayerRepository(pool);
const playerService = new PlayerService(playerRepository);

export async function authenticatePlayer(req: Request, res: Response, next: NextFunction) {
  // Skip header validation for player creation
  if (req.method === 'POST' && req.path === '/players') {
    return next();
  }

  const playerId = req.header('X-Player-ID');
  if (!playerId) {
    return res.status(400).json({ error: 'Missing required header: X-Player-ID' });
  }
  if (!validator.isUUID(playerId)) {
    return res.status(400).json({ error: 'Invalid UUID for header: X-Player-ID' });
  }

  try {
    const player = await playerService.getPlayerById(playerId);
    req.playerId = player.id;
  } catch (error: any) {
    if (error instanceof PlayerNotFoundException) {
      throw new UnauthorizedException(playerId);
    }
    throw error;
  }

  next();
}
