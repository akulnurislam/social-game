import { Router } from 'express';
import { pool } from '../../core/db';
import { GroupRepository } from '../group/group.repository';
import { GroupService } from '../group/group.service';
import { LeaderboardRepository } from '../leaderboard/leaderboard.repository';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { BattleRepository } from './battle.repository';
import { BattleService } from './battle.service';

const groupRepository = new GroupRepository(pool);
const leaderboardRepository = new LeaderboardRepository(pool);
const battleRepository = new BattleRepository(pool);

const groupService = new GroupService(groupRepository);
const leaderboardService = new LeaderboardService(leaderboardRepository)
const battleService = new BattleService(battleRepository, groupService, leaderboardService);

const router = Router();

/**
 * POST /battles
 * Body: { "groupAttacker": "<uuid>", "groupDefender": "<uuid>", "meta": { "mode": "classic" } }
 * Header: X-Player-ID: <uuid>
 */
router.post('/', async (req, res) => {
  const {
    group_attacker: groupAttacker,
    group_defender: groupDefender,
    meta,
  } = req.body ?? {};
  if (!groupAttacker) {
    return res.status(400).json({ error: 'group_attacker required' });
  }
  if (!groupDefender) {
    return res.status(400).json({ error: 'group_defender required' });
  }

  const battle = await battleService.createBattle(groupAttacker, groupDefender, meta, req.playerId);
  return res.status(201).json(battle);
});

/**
 * POST /battles/:battleId/begin
 * Header: X-Player-ID: <uuid>
 */
router.post('/:battleId/begin', async (req, res) => {
  const { battleId } = req.params;
  const battle = await battleService.beginBattle(req.playerId, battleId);
  res.json(battle);
});

/**
 * POST /battles/:battleId/finish
 * Header: X-Player-ID: <uuid>
 */
router.post('/:battleId/finish', async (req, res) => {
  const { battleId } = req.params;
  const battle = await battleService.finishBattle(req.playerId, battleId);
  res.json(battle);
});

/**
 * POST /battles/:battleId/join
 * Header: X-Player-ID: <uuid>
 */
router.post('/:battleId/join', async (req, res) => {
  const { battleId } = req.params;
  const member = await battleService.joinBattle(req.playerId, battleId);
  res.json(member || { message: 'Already joined' });
});

/**
 * GET /battles/:battleId/members
 * Header: X-Player-ID: <uuid>
 */
router.get('/:battleId/members', async (req, res) => {
  const { battleId } = req.params;
  const members = await battleService.listMembers(battleId);
  res.json(members);
});

export default router;
