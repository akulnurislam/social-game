import { Router } from 'express';
import { pool } from '../../core/db';
import { LeaderboardRepository } from './leaderboard.repository';
import { LeaderboardService } from './leaderboard.service';

const repo = new LeaderboardRepository(pool);
const service = new LeaderboardService(repo);

const router = Router();

/**
 * GET /leaderboards
 * Query: ?limit=10&offset=0
 * Header: X-Player-ID: <uuid>
 */
router.get('/', async (req, res) => {
  const limit = Number(req.query['limit']) || 20;
  const offset = Number(req.query['offset']) || 0;
  const leaderboards = await service.listLeaderboards(limit, offset);
  res.json(leaderboards);
});

export default router;
