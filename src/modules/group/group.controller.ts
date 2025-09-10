import { Router } from 'express';
import { pool } from '../../core/db';
import { validateUUID } from '../../middlewares/validate-uuid';
import { GroupRepository } from './group.repository';
import { GroupService } from './group.service';

const repo = new GroupRepository(pool);
const service = new GroupService(repo);

const router = Router();

/**
 * POST /groups
 * Body: { "name": "Red Dragons" }
 * Header: X-Player-ID: <uuid>
 */
router.post('/', async (req, res) => {
  const { name } = req.body ?? {};
  if (!name) {
    return res.status(400).json({ error: 'name required' });
  }

  const group = await service.createGroup(name, req.playerId);
  return res.status(201).json(group);
});

/**
 * GET /groups
 * Query: ?limit=10&offset=0
 * Header: X-Player-ID: <uuid>
 */
router.get('/', async (req, res) => {
  const limit = Number(req.query['limit']) || 20;
  const offset = Number(req.query['offset']) || 0;
  const groups = await service.listGroups(limit, offset);
  return res.json(groups);
});

/**
 * GET /groups/:groupId
 * Header: X-Player-ID: <uuid>
 */
router.get('/:groupId', validateUUID, async (req, res) => {
  const { groupId } = req.params;
  const group = await service.getGroupById(groupId!);
  return res.json(group);
});

/**
 * GET /groups/:groupId/members
 * Header: X-Player-ID: <uuid>
 */
router.get('/:groupId/members', validateUUID, async (req, res) => {
  const { groupId } = req.params;
  const members = await service.listMembers(groupId!);
  return res.json(members);
});

/**
 * POST /groups/:groupId/join
 * Header: X-Player-ID: <uuid>
 */
router.post('/:groupId/join', validateUUID, async (req, res) => {
  const { groupId } = req.params;
  const result = await service.joinGroup(groupId!, req.playerId);
  return res.json(result);
});

/**
 * POST /groups/:groupId/leave
 * Header: X-Player-ID: <uuid>
 */
router.post('/:groupId/leave', validateUUID, async (req, res) => {
  const { groupId } = req.params;
  const result = await service.leaveGroup(groupId!, req.playerId);
  return res.json(result);
});

export default router;
