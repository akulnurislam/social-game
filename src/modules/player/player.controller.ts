import { Router } from 'express';
import validator from 'validator';
import { pool } from '../../core/db';
import { PlayerRepository } from './player.repository';
import { PlayerService } from './player.service';

// dependency injection
const repo = new PlayerRepository(pool);
const service = new PlayerService(repo);

const router = Router();

/**
 * POST /players
 * Body: { "username": "dragon_slayer" }
 */
router.post('/', async (req, res) => {
  const { username, telegramId } = req.body ?? {};
  if (!username) {
    return res.status(400).json({ error: 'username required' });
  }
  if (!telegramId) {
    return res.status(400).json({ error: 'telegramId required' });
  }
  if (!validator.isNumeric(telegramId)) {
    return res.status(400).json({ error: 'telegramId must be number' });
  }

  const player = await service.createPlayer(username, telegramId);
  return res.status(201).json(player);
});

/**
 * GET /players/me
 * Header: X-Player-ID: <uuid>
 */
router.get('/me', async (req, res) => {
  const player = await service.getPlayerById(req.playerId);
  return res.json(player);
});

export default router;
