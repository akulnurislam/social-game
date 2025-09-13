import { redis } from '../core/redis';
import * as RedisUtils from './redis-utils';

jest.mock('../core/redis', () => ({
  redis: {
    incr: jest.fn(),
    expire: jest.fn(),
    set: jest.fn(),
    eval: jest.fn(),
    sadd: jest.fn(),
    smembers: jest.fn(),
    del: jest.fn(),
    ttl: jest.fn(),
    zincrby: jest.fn(),
  },
}));

describe('Redis Utils', () => {
  const mockRedis = redis as jest.Mocked<typeof redis>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('rateLimitKey', () => {
    it('should increment and set expiry on first call', async () => {
      mockRedis.incr.mockResolvedValue(1);
      const count = await RedisUtils.rateLimitKey('player1', 'action1', 60);
      expect(count).toBe(1);
      expect(mockRedis.expire).toHaveBeenCalledWith('ratelimit:player1:action1', 60);
    });

    it('should increment without setting expiry on subsequent calls', async () => {
      mockRedis.incr.mockResolvedValue(2);
      const count = await RedisUtils.rateLimitKey('player1', 'action1');
      expect(count).toBe(2);
      expect(mockRedis.expire).not.toHaveBeenCalled();
    });
  });

  describe('tryAcquireGroupCooldown', () => {
    it('should return true if cooldown acquired', async () => {
      mockRedis.set.mockResolvedValue('OK');
      const result = await RedisUtils.tryAcquireGroupCooldown('group1', 'action1', 1000);
      expect(result).toBe(true);
    });

    it('should return false if cooldown not acquired', async () => {
      mockRedis.set.mockResolvedValue(null);
      const result = await RedisUtils.tryAcquireGroupCooldown('group1', 'action1', 1000);
      expect(result).toBe(false);
    });
  });

  describe('acquireLock', () => {
    it('should return token if lock acquired', async () => {
      mockRedis.set.mockResolvedValue('OK');
      const token = await RedisUtils.acquireLock('lock1', 1000);
      expect(typeof token).toBe('string');
      expect(mockRedis.set).toHaveBeenCalled();
    });

    it('should return null if lock not acquired', async () => {
      mockRedis.set.mockResolvedValue(null);
      const token = await RedisUtils.acquireLock('lock1', 1000);
      expect(token).toBeNull();
    });
  });

  describe('releaseLock', () => {
    it('should call redis.eval', async () => {
      mockRedis.eval.mockResolvedValue(1);
      await RedisUtils.releaseLock('lock1', 'token123');
      expect(mockRedis.eval).toHaveBeenCalled();
    });
  });

  describe('setBattleMember & getBattleMembers & deleteBattleMembers', () => {
    it('should add member and set expiry if first', async () => {
      mockRedis.sadd.mockResolvedValue(1);
      mockRedis.smembers.mockResolvedValue(['player1']);
      mockRedis.expire.mockResolvedValue(1);

      await RedisUtils.setBattleMember('player1', 'battle1');
      expect(mockRedis.sadd).toHaveBeenCalledWith('member:battle:battle1', 'player1');
      expect(mockRedis.expire).toHaveBeenCalledWith('member:battle:battle1', 1800);
    });

    it('should return battle members', async () => {
      mockRedis.smembers.mockResolvedValue(['player1', 'player2']);
      const members = await RedisUtils.getBattleMembers('battle1');
      expect(members).toEqual(['player1', 'player2']);
    });

    it('should delete battle members', async () => {
      mockRedis.del.mockResolvedValue(2);
      const deleted = await RedisUtils.deleteBattleMembers('battle1');
      expect(deleted).toBe(2);
    });
  });

  describe('updateLeaderboard & getLeaderboard', () => {
    it('should increment member score and set TTL if missing', async () => {
      mockRedis.zincrby.mockResolvedValue('100');
      mockRedis.ttl.mockResolvedValue(-1);
      mockRedis.expire.mockResolvedValue(1);

      await RedisUtils.updateLeaderboard('group1', 100);

      expect(mockRedis.zincrby).toHaveBeenCalledWith('leaderboard:24h', 100, 'group1');
      expect(mockRedis.ttl).toHaveBeenCalledWith('leaderboard:24h');
      expect(mockRedis.expire).toHaveBeenCalledWith('leaderboard:24h', 86400);
    });

    it('should increment member score without setting TTL if already set', async () => {
      mockRedis.zincrby.mockResolvedValue('200');
      mockRedis.ttl.mockResolvedValue(3600); // TTL already exists

      await RedisUtils.updateLeaderboard('group1', 100);

      expect(mockRedis.zincrby).toHaveBeenCalledWith('leaderboard:24h', 100, 'group1');
      expect(mockRedis.ttl).toHaveBeenCalledWith('leaderboard:24h');
      expect(mockRedis.expire).not.toHaveBeenCalled();
    });

    it('should return formatted leaderboard', async () => {
      mockRedis.zrevrange = jest.fn().mockResolvedValue(['group1', '100', 'group2', '80']);
      const leaderboard = await RedisUtils.getLeaderboard(2);
      expect(leaderboard).toEqual([
        { rank: 1, groupId: 'group1', score: 100 },
        { rank: 2, groupId: 'group2', score: 80 },
      ]);
    });
  });
});
