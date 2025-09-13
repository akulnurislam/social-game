import {
  CHANNEL_BATTLE_BEGIN,
  CHANNEL_BATTLE_FINISHED,
  CHANNEL_BATTLE_JOIN,
} from '../../constants/redis-channels';
import { redisPublisher } from '../../core/redis';
import { AppException } from '../../exceptions/app-exception';
import * as redisUtils from '../../utils/redis-utils';
import { GroupService } from '../group/group.service';
import { LeaderboardService } from '../leaderboard/leaderboard.service';
import { BattleRepository } from './battle.repository';
import { BattleService } from './battle.service';

// Mock all external dependencies
jest.mock('../../utils/redis-utils');
jest.mock('../../core/redis');

describe('BattleService', () => {
  let battleService: BattleService;
  let mockRepo: jest.Mocked<BattleRepository>;
  let mockGroupService: jest.Mocked<GroupService>;
  let mockLeaderboardService: jest.Mocked<LeaderboardService>;
  let mockRedisPublisher: jest.Mocked<typeof redisPublisher>;

  const mockDate = new Date();

  const mockBattle = {
    id: 'battle-123',
    group_attacker: 'group-1',
    group_defender: 'group-2',
    state: 'pending' as const,
    meta: { mode: 'classic' },
    started_at: null,
    finished_at: null,
    created_at: mockDate,
    updated_at: mockDate,
  };

  const mockAttackerMembers = [
    { player_id: 'player-1', group_id: 'group-1', role: 'owner', joined_at: mockDate },
    { player_id: 'player-2', group_id: 'group-1', role: 'member', joined_at: mockDate },
  ];

  const mockDefenderMembers = [
    { player_id: 'player-3', group_id: 'group-2', role: 'owner', joined_at: mockDate },
    { player_id: 'player-4', group_id: 'group-2', role: 'member', joined_at: mockDate },
  ];

  const mockBattleMembers = [
    { battle_id: 'battle-123', player_id: 'player-1', role: 'initiator', joined_at: mockDate },
  ];


  beforeEach(() => {
    // Create mocked instances
    mockRepo = {
      createBattle: jest.fn(),
      findById: jest.fn(),
      updateState: jest.fn(),
      addMember: jest.fn(),
      listMembers: jest.fn(),
      pool: {} as any, // Mock the pool property
    } as unknown as jest.Mocked<BattleRepository>;

    mockGroupService = {
      listMembers: jest.fn(),
      createGroup: jest.fn(),
      listGroups: jest.fn(),
      getGroupById: jest.fn(),
      joinGroup: jest.fn(),
      leaveGroup: jest.fn(),
      repo: {} as any, // Mock the repo property
    } as unknown as jest.Mocked<GroupService>;

    mockLeaderboardService = {
      upsertLeaderboard: jest.fn(),
      getTop: jest.fn(),
      listLeaderboards: jest.fn(),
      repo: {} as any, // Mock the repo property
    } as unknown as jest.Mocked<LeaderboardService>;

    mockRedisPublisher = redisPublisher as jest.Mocked<typeof redisPublisher>;

    battleService = new BattleService(mockRepo, mockGroupService, mockLeaderboardService);

    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock implementations
    (redisUtils.rateLimitKey as jest.Mock).mockResolvedValue(1);
    (redisUtils.tryAcquireGroupCooldown as jest.Mock).mockResolvedValue(true);
    (redisUtils.acquireLock as jest.Mock).mockResolvedValue('lock-token');
    (redisUtils.releaseLock as jest.Mock).mockResolvedValue(undefined);
    (redisUtils.setBattleMember as jest.Mock).mockResolvedValue(undefined);
    (redisUtils.deleteBattleMembers as jest.Mock).mockResolvedValue(undefined);
    (redisUtils.updateLeaderboard as jest.Mock).mockResolvedValue(undefined);
    mockRedisPublisher.publish.mockResolvedValue(1);
  });

  describe('createBattle', () => {
    beforeEach(() => {
      mockGroupService.listMembers
        .mockResolvedValueOnce(mockAttackerMembers)
        .mockResolvedValueOnce(mockDefenderMembers);
      mockRepo.createBattle.mockResolvedValue(mockBattle);
      mockRepo.addMember.mockResolvedValue(mockBattleMembers[0] ?? null);
    });

    it('should create a battle successfully when creator is attacker member', async () => {
      const result = await battleService.createBattle('group-1', 'group-2', { mode: 'classic' }, 'player-1');

      expect(result).toEqual(mockBattle);
      expect(mockRepo.createBattle).toHaveBeenCalledWith('group-1', 'group-2', { mode: 'classic' });
      expect(mockRepo.addMember).toHaveBeenCalledWith('battle-123', 'player-1', 'initiator');
      expect(redisUtils.setBattleMember).toHaveBeenCalledWith('player-1', 'battle-123');
    });

    it('should create a battle successfully when creator is defender member', async () => {
      const result = await battleService.createBattle('group-1', 'group-2', { mode: 'classic' }, 'player-3');

      expect(result).toEqual(mockBattle);
      expect(mockRepo.createBattle).toHaveBeenCalledWith('group-1', 'group-2', { mode: 'classic' });
    });

    it('should throw error when creator is member of both groups', async () => {
      const bothGroupsMembers = [...mockAttackerMembers, ...mockDefenderMembers];
      mockGroupService.listMembers
        .mockResolvedValueOnce([...bothGroupsMembers, { player_id: 'player-5', group_id: 'group-1', role: 'member', joined_at: mockDate }])
        .mockResolvedValueOnce([...bothGroupsMembers, { player_id: 'player-5', group_id: 'group-2', role: 'member', joined_at: mockDate }]);

      await expect(
        battleService.createBattle('group-1', 'group-2', { mode: 'classic' }, 'player-5')
      ).rejects.toThrow(new AppException('Creator must be a member of exactly one group (attacker or defender).', 400));
    });

    it('should throw error when creator is not member of either group', async () => {
      await expect(
        battleService.createBattle('group-1', 'group-2', { mode: 'classic' }, 'player-unknown')
      ).rejects.toThrow(new AppException('Creator must be a member of exactly one group (attacker or defender).', 400));
    });

    it('should throw error when rate limit exceeded', async () => {
      (redisUtils.rateLimitKey as jest.Mock).mockResolvedValue(2);

      await expect(
        battleService.createBattle('group-1', 'group-2', { mode: 'classic' }, 'player-1')
      ).rejects.toThrow(new AppException('Too many battle creation attempts. Try again later.', 429));
    });

    it('should throw error when group is on cooldown', async () => {
      (redisUtils.tryAcquireGroupCooldown as jest.Mock).mockResolvedValue(false);

      await expect(
        battleService.createBattle('group-1', 'group-2', { mode: 'classic' }, 'player-1')
      ).rejects.toThrow(new AppException('Attacking group is on cooldown. Try later.', 429));
    });

    it('should use default meta when not provided', async () => {
      await battleService.createBattle('group-1', 'group-2', undefined, 'player-1');

      expect(mockRepo.createBattle).toHaveBeenCalledWith('group-1', 'group-2', { mode: 'classic' });
    });
  });

  describe('beginBattle', () => {
    beforeEach(() => {
      mockRepo.findById.mockResolvedValue(mockBattle);
      mockRepo.listMembers.mockResolvedValue(mockBattleMembers);
      mockRepo.updateState.mockResolvedValue({ ...mockBattle, state: 'running' });
    });

    it('should begin battle successfully when called by initiator', async () => {
      const result = await battleService.beginBattle('player-1', 'battle-123');

      expect(result).toEqual({ ...mockBattle, state: 'running' });
      expect(redisUtils.acquireLock).toHaveBeenCalledWith('battle:battle-123:begin', 5000);
      expect(mockRedisPublisher.publish).toHaveBeenCalledWith(
        CHANNEL_BATTLE_BEGIN,
        JSON.stringify({ battleId: 'battle-123' })
      );
      expect(redisUtils.releaseLock).toHaveBeenCalledWith('battle:battle-123:begin', 'lock-token');
    });

    it('should begin battle successfully when called by attacker owner', async () => {
      mockRepo.listMembers.mockResolvedValue([]);
      mockGroupService.listMembers.mockResolvedValueOnce(mockAttackerMembers);

      const result = await battleService.beginBattle('player-1', 'battle-123');

      expect(result).toEqual({ ...mockBattle, state: 'running' });
    });

    it('should begin battle successfully when called by defender owner', async () => {
      mockRepo.listMembers.mockResolvedValue([]);
      mockGroupService.listMembers
        .mockResolvedValueOnce([]) // attacker members (player not found)
        .mockResolvedValueOnce(mockDefenderMembers); // defender members

      const result = await battleService.beginBattle('player-3', 'battle-123');

      expect(result).toEqual({ ...mockBattle, state: 'running' });
    });

    it('should throw error when battle not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(battleService.beginBattle('player-1', 'battle-123')).rejects.toThrow(
        new AppException('Battle not found.', 404)
      );
    });

    it('should throw error when battle is not in pending state', async () => {
      mockRepo.findById.mockResolvedValue({ ...mockBattle, state: 'running' });

      await expect(battleService.beginBattle('player-1', 'battle-123')).rejects.toThrow(
        new AppException('Battle cannot be started.', 400)
      );
    });

    it('should throw error when lock cannot be acquired', async () => {
      (redisUtils.acquireLock as jest.Mock).mockResolvedValue(null);

      await expect(battleService.beginBattle('player-1', 'battle-123')).rejects.toThrow(
        new AppException('Battle is already being started.', 409)
      );
    });

    it('should throw error when player is not authorized', async () => {
      mockRepo.listMembers.mockResolvedValue([]);
      mockGroupService.listMembers.mockResolvedValue([]);

      await expect(battleService.beginBattle('player-unknown', 'battle-123')).rejects.toThrow(
        new AppException('Not authorized to start this battle.', 403)
      );
    });

    it('should release lock even if error occurs', async () => {
      mockRepo.listMembers.mockRejectedValue(new Error('Database error'));

      await expect(battleService.beginBattle('player-1', 'battle-123')).rejects.toThrow('Database error');
      expect(redisUtils.releaseLock).toHaveBeenCalledWith('battle:battle-123:begin', 'lock-token');
    });
  });

  describe('finishBattle', () => {
    const runningBattle = {
      ...mockBattle,
      state: 'running' as const,
      started_at: new Date(Date.now() - 120000), // 2 minutes ago
    };

    beforeEach(() => {
      mockRepo.findById.mockResolvedValue(runningBattle);
      mockRepo.listMembers.mockResolvedValue(mockBattleMembers);
      mockRepo.updateState.mockResolvedValue({ ...runningBattle, state: 'finished' });
      mockLeaderboardService.upsertLeaderboard.mockResolvedValue(null);

      // Mock Math.random for predictable winner selection
      jest.spyOn(Math, 'random').mockReturnValue(0.3);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should finish battle successfully when called by initiator', async () => {
      const result = await battleService.finishBattle('player-1', 'battle-123');

      expect(result).toEqual({ ...runningBattle, state: 'finished' });
      expect(mockLeaderboardService.upsertLeaderboard).toHaveBeenCalled();
      expect(redisUtils.deleteBattleMembers).toHaveBeenCalledWith('battle-123');
      expect(redisUtils.updateLeaderboard).toHaveBeenCalled();
      expect(mockRedisPublisher.publish).toHaveBeenCalledWith(
        CHANNEL_BATTLE_FINISHED,
        expect.stringContaining('"battleId":"battle-123"')
      );
    });

    it('should finish battle successfully when called by group owner', async () => {
      mockRepo.listMembers.mockResolvedValue([]);
      mockGroupService.listMembers.mockResolvedValueOnce(mockAttackerMembers);

      const result = await battleService.finishBattle('player-1', 'battle-123');

      expect(result).toEqual({ ...runningBattle, state: 'finished' });
    });

    it('should throw error when battle not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(battleService.finishBattle('player-1', 'battle-123')).rejects.toThrow(
        new AppException('Battle not found.', 404)
      );
    });

    it('should throw error when battle is not running', async () => {
      mockRepo.findById.mockResolvedValue(mockBattle);

      await expect(battleService.finishBattle('player-1', 'battle-123')).rejects.toThrow(
        new AppException('Battle cannot be finished.', 400)
      );
    });

    it('should throw error when battle duration is too short', async () => {
      const recentBattle = {
        ...runningBattle,
        started_at: new Date(Date.now() - 30000), // 30 seconds ago
      };
      mockRepo.findById.mockResolvedValue(recentBattle);

      await expect(battleService.finishBattle('player-1', 'battle-123')).rejects.toThrow(
        new AppException('Battle cannot be finished yet.', 400)
      );
    });

    it('should throw error when player is not authorized', async () => {
      mockRepo.listMembers.mockResolvedValue([]);
      mockGroupService.listMembers.mockResolvedValue([]);

      await expect(battleService.finishBattle('player-unknown', 'battle-123')).rejects.toThrow(
        new AppException('Not authorized to finish this battle.', 403)
      );
    });

    it('should randomly select winner and generate score', async () => {
      jest.spyOn(Math, 'random').mockReturnValueOnce(0.3).mockReturnValueOnce(0.7); // winner selection, score generation

      await battleService.finishBattle('player-1', 'battle-123');

      expect(mockLeaderboardService.upsertLeaderboard).toHaveBeenCalledWith('group-1', expect.any(Number));
      expect(redisUtils.updateLeaderboard).toHaveBeenCalledWith('group-1', expect.any(Number));
    });
  });

  describe('joinBattle', () => {
    beforeEach(() => {
      mockRepo.findById.mockResolvedValue(mockBattle);
      mockRepo.listMembers.mockResolvedValue([]);
      mockRepo.addMember.mockResolvedValue({
        battle_id: 'battle-123',
        player_id: 'player-2',
        role: 'participant',
        joined_at: mockDate,
      });
      mockGroupService.listMembers
        .mockResolvedValueOnce(mockAttackerMembers)
        .mockResolvedValueOnce(mockDefenderMembers);
    });

    it('should join battle successfully when player is attacker member', async () => {
      const result = await battleService.joinBattle('player-2', 'battle-123');

      expect(result).toEqual({
        battle_id: 'battle-123',
        player_id: 'player-2',
        role: 'participant',
        joined_at: mockDate,
      });
      expect(redisUtils.setBattleMember).toHaveBeenCalledWith('player-2', 'battle-123');
      expect(mockRedisPublisher.publish).toHaveBeenCalledWith(
        CHANNEL_BATTLE_JOIN,
        JSON.stringify({ battleId: 'battle-123', playerId: 'player-2' })
      );
    });

    it('should join battle successfully when player is defender member', async () => {
      const result = await battleService.joinBattle('player-4', 'battle-123');

      expect(result).toEqual({
        battle_id: 'battle-123',
        player_id: 'player-2',
        role: 'participant',
        joined_at: mockDate,

      });
    });

    it('should join battle with custom role', async () => {
      await battleService.joinBattle('player-2', 'battle-123', 'observer');

      expect(mockRepo.addMember).toHaveBeenCalledWith('battle-123', 'player-2', 'observer');
    });

    it('should throw error when battle not found', async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(battleService.joinBattle('player-2', 'battle-123')).rejects.toThrow(
        new AppException('Battle not found.', 404)
      );
    });

    it('should throw error when battle is finished', async () => {
      mockRepo.findById.mockResolvedValue({ ...mockBattle, state: 'finished' });

      await expect(battleService.joinBattle('player-2', 'battle-123')).rejects.toThrow(
        new AppException('Cannot join battle.', 400)
      );
    });

    it('should throw error when player already joined', async () => {
      mockRepo.listMembers.mockResolvedValue([
        { battle_id: 'battle-123', player_id: 'player-2', role: 'participant', joined_at: mockDate },
      ]);

      await expect(battleService.joinBattle('player-2', 'battle-123')).rejects.toThrow(
        new AppException('Player already joined this battle.', 400)
      );
    });

    it('should throw error when rate limit exceeded', async () => {
      (redisUtils.rateLimitKey as jest.Mock).mockResolvedValue(4);

      await expect(battleService.joinBattle('player-2', 'battle-123')).rejects.toThrow(
        new AppException('Too many join attempts. Try again later.', 429)
      );
    });

    it('should throw error when player belongs to both groups', async () => {
      mockGroupService.listMembers.mockReset();
      mockGroupService.listMembers
        .mockResolvedValueOnce([...mockAttackerMembers, { player_id: 'player-5', group_id: 'group-1', role: 'member', joined_at: mockDate }])
        .mockResolvedValueOnce([...mockDefenderMembers, { player_id: 'player-5', group_id: 'group-2', role: 'member', joined_at: mockDate }]);

      await expect(battleService.joinBattle('player-5', 'battle-123')).rejects.toThrow(
        new AppException('Player belongs to both groups; cannot join', 400)
      );
    });

    it('should throw error when player is not member of either group', async () => {
      await expect(battleService.joinBattle('player-unknown', 'battle-123')).rejects.toThrow(
        new AppException('Player is not a member of either group', 400)
      );
    });

    it('should handle group service errors gracefully', async () => {
      mockGroupService.listMembers.mockReset();
      mockGroupService.listMembers.mockRejectedValue(new Error('Group service error'));

      await expect(battleService.joinBattle('player-2', 'battle-123')).rejects.toThrow(
        new AppException('Player is not a member of either group', 400)
      );
    });
  });

  describe('listMembers', () => {
    it('should return battle members', async () => {
      mockRepo.listMembers.mockResolvedValue(mockBattleMembers);

      const result = await battleService.listMembers('battle-123');

      expect(result).toEqual(mockBattleMembers);
      expect(mockRepo.listMembers).toHaveBeenCalledWith('battle-123');
    });
  });

  describe('private methods', () => {
    describe('randomScore', () => {
      beforeEach(() => {
        jest.spyOn(Math, 'random').mockReturnValue(0.5);
      });

      afterEach(() => {
        jest.restoreAllMocks();
      });

      it('should generate score within default range', async () => {
        // Access private method through any cast for testing
        const score = (battleService as any).randomScore();

        expect(score).toBeGreaterThanOrEqual(10);
        expect(score).toBeLessThanOrEqual(100);
      });

      it('should generate score within custom range', async () => {
        const score = (battleService as any).randomScore(50, 200);

        expect(score).toBeGreaterThanOrEqual(50);
        expect(score).toBeLessThanOrEqual(200);
      });
    });
  });
});
