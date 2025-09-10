import { Router } from 'express';
import { PlayerRepository } from './player.repository';
import { PlayerService } from './player.service';
import { pool } from '../../core/db';

// dependency injection
const repo = new PlayerRepository(pool);
const service = new PlayerService(repo);

const router = Router();

/**
 * POST /players
 * Body: { "username": "dragon_slayer" }
 */
router.post('/', async (req, res) => {
  try {
    const { username } = req.body ?? {};
    if (!username) {
      return res.status(400).json({ error: 'username required' });
    }

    const player = await service.createPlayer(username);
    return res.status(201).json(player);
  } catch (err: any) {
    if (err.code === '23505') {
      // unique_violation
      return res.status(409).json({ error: 'username already exists' });
    }
    console.error(err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

/**
 * GET /players/me
 * Header: X-Player-ID: <uuid>
 */
router.get('/me', async (req, res) => {
  try {
    const player = await service.getPlayerById(req.playerId);
    if (!player) {
      return res.status(404).json({ error: 'player not found' });
    }

    return res.json(player);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'internal server error' });
  }
});

export default router;
