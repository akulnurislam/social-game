import {
  CHANNEL_BATTLE_BEGIN,
  CHANNEL_BATTLE_FINISHED,
  CHANNEL_BATTLE_JOIN,
} from '../../constants/redis-channels';
import { redisPublisher } from '../../core/redis';
import { AppException } from '../../exceptions/app-exception';
import {
  acquireLock,
  deleteBattleMembers,
  rateLimitKey,
  releaseLock,
  setBattleMember,
  tryAcquireGroupCooldown,
  updateLeaderboard,
} from '../../utils/redis-utils';
import type { GroupService } from '../group/group.service';
import type { LeaderboardService } from '../leaderboard/leaderboard.service';
import { BattleRepository } from './battle.repository';

export class BattleService {
  constructor(
    private readonly repo: BattleRepository,
    private readonly groupService: GroupService,
    private readonly leaderboardService: LeaderboardService,
  ) { }

  async createBattle(
    attackerGroupId: string,
    defenderGroupId: string,
    meta: Record<string, any> = { mode: 'classic' },
    creatorPlayerId: string,
  ) {
    const attackerMembers = await this.groupService.listMembers(attackerGroupId);
    const defenderMembers = await this.groupService.listMembers(defenderGroupId);

    const isAttackerMember = attackerMembers.some(m => m.player_id === creatorPlayerId);
    const isDefenderMember = defenderMembers.some(m => m.player_id === creatorPlayerId);

    if (isAttackerMember === isDefenderMember) {
      throw new AppException('Creator must be a member of exactly one group (attacker or defender).', 400);
    }

    // pre-player rate limit: max 1 create attempts per minute
    const createCount = await rateLimitKey(creatorPlayerId, 'create_battle', 60);
    const BATTLE_CREATE_LIMIT = 1;
    if (createCount > BATTLE_CREATE_LIMIT) {
      throw new AppException('Too many battle creation attempts. Try again later.', 429);
    }

    // group cooldown (prevent attacker group spam)
    const BATTLE_COOLDOWN_MS = 60_000 * 5; // 5 minutes cooldown for group attacks
    const cooldownAcquired = await tryAcquireGroupCooldown(attackerGroupId, 'attack', BATTLE_COOLDOWN_MS);
    if (!cooldownAcquired) {
      throw new AppException('Attacking group is on cooldown. Try later.', 429);
    }

    const battle = await this.repo.createBattle(attackerGroupId, defenderGroupId, meta);
    // auto-add creator as participant (role: initiator)
    if (battle) {
      await this.repo.addMember(battle.id, creatorPlayerId, 'initiator');
      await setBattleMember(creatorPlayerId, battle.id);
    }

    return battle;
  }

  async beginBattle(callerPlayerId: string, battleId: string) {
    const battle = await this.repo.findById(battleId);
    if (!battle) throw new AppException('Battle not found.', 404);
    if (battle.state !== 'pending') throw new AppException('Battle cannot be started.', 400);

    // Acquire lock name specific to this battle
    const BATTLE_LOCK_MS = 5_000;
    const lockName = `battle:${battleId}:begin`;
    const token = await acquireLock(lockName, BATTLE_LOCK_MS);
    if (!token) {
      throw new AppException('Battle is already being started.', 409);
    }

    try {
      const members = await this.repo.listMembers(battleId);
      const isInitiator = members.some(m => m.player_id === callerPlayerId && m.role === 'initiator');

      // if not initiator, also allow group owner to start
      const isAttackerOwner = await this.isOwnerGroup(callerPlayerId, battle.group_attacker).catch(() => false);
      const isDefenderOwner = await this.isOwnerGroup(callerPlayerId, battle.group_defender).catch(() => false);

      if (!isInitiator && !isAttackerOwner && !isDefenderOwner) {
        throw new AppException('Not authorized to start this battle.', 403);
      }

      await redisPublisher.publish(CHANNEL_BATTLE_BEGIN, JSON.stringify({ battleId }));
      return await this.repo.updateState(battleId, 'running', { started: new Date() });
    } finally {
      await releaseLock(lockName, token);
    }
  }

  async finishBattle(callerPlayerId: string, battleId: string) {
    const battle = await this.repo.findById(battleId);
    if (!battle) throw new AppException('Battle not found.', 404);
    if (battle.state !== 'running') throw new AppException(`Battle cannot be finished.`, 400);

    // Prevent finishing too soon: enforce min duration (60 seconds)
    const BATTLE_MIN_DURATION_MS = 60_000;
    if (battle.started_at) {
      const elapsed = Date.now() - new Date(battle.started_at).getTime();
      if (elapsed < BATTLE_MIN_DURATION_MS) {
        throw new AppException('Battle cannot be finished yet.', 400);
      }
    }

    const members = await this.repo.listMembers(battleId);
    const isInitiator = members.some(m => m.player_id === callerPlayerId && m.role === 'initiator');

    // if not initiator, also allow group owner to start
    const isAttackerOwner = await this.isOwnerGroup(callerPlayerId, battle.group_attacker).catch(() => false);
    const isDefenderOwner = await this.isOwnerGroup(callerPlayerId, battle.group_defender).catch(() => false);

    if (!isInitiator && !isAttackerOwner && !isDefenderOwner) {
      throw new AppException('Not authorized to finish this battle.', 403);
    }

    // update finished state
    const finished = await this.repo.updateState(battleId, 'finished', { finished: new Date() });

    // simple simulation the winner and score
    const winnerGroupId = Math.random() < 0.5 ? battle.group_attacker : battle.group_defender;
    const score = this.randomScore();

    await this.leaderboardService.upsertLeaderboard(winnerGroupId, score);
    await deleteBattleMembers(battleId);
    await updateLeaderboard(winnerGroupId, score);
    await redisPublisher.publish(CHANNEL_BATTLE_FINISHED, JSON.stringify({ battleId, winnerGroupId, score }));

    return finished;
  }

  async joinBattle(playerId: string, battleId: string, role = 'participant') {
    const battle = await this.repo.findById(battleId);
    if (!battle) throw new AppException('Battle not found.', 404);
    if (battle.state === 'finished') throw new AppException(`Cannot join battle.`, 400);

    // prevent duplicate join
    const existingMembers = await this.repo.listMembers(battleId);
    if (existingMembers.some(m => m.player_id === playerId)) {
      throw new AppException('Player already joined this battle.', 400);
    }

    // rate-limit join actions: max 3 joins per minute
    const joinCount = await rateLimitKey(playerId, 'join_battle', 60);
    const BATTLE_JOIN_LIMIT = 3;
    if (joinCount > BATTLE_JOIN_LIMIT) {
      throw new AppException('Too many join attempts. Try again later.', 429);
    }

    // validate player group membership: player must belong to one side
    const isAttackerMember = await this.isMemberGroup(playerId, battle.group_attacker).catch(() => false);
    const isDefenderMember = await this.isMemberGroup(playerId, battle.group_defender).catch(() => false);

    if (isAttackerMember && isDefenderMember) {
      throw new AppException('Player belongs to both groups; cannot join', 400);
    }
    if (!isAttackerMember && !isDefenderMember) {
      throw new AppException('Player is not a member of either group', 400);
    }

    const member = await this.repo.addMember(battleId, playerId, role);
    await setBattleMember(playerId, battleId);
    await redisPublisher.publish(CHANNEL_BATTLE_JOIN, JSON.stringify({ battleId, playerId }));

    return member;
  }

  async listMembers(battleId: string) {
    return this.repo.listMembers(battleId);
  }

  private async isMemberGroup(playerId: string, groupId: string): Promise<boolean> {
    const members = await this.groupService.listMembers(groupId);
    return members.some(m => m.player_id === playerId);
  }

  private async isOwnerGroup(playerId: string, groupId: string): Promise<boolean> {
    const members = await this.groupService.listMembers(groupId);
    return members.some(m => m.player_id === playerId && m.role === 'owner');
  }

  private randomScore(min: number = 10, max: number = 100): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
