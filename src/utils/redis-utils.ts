import { redis } from '../core/redis';

export async function rateLimitKey(playerId: string, action: string, windowSeconds = 60) {
  const key = `ratelimit:${playerId}:${action}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, windowSeconds);
  }
  return count;
}

/**
 * Try to set a cooldown for a group. Returns true if cooldown acquired (no previous cooldown),
 * false if still on cooldown.
 */
export async function tryAcquireGroupCooldown(groupId: string, action: string, cooldownMs: number) {
  const key = `cooldown:${action}:${groupId}`;
  const res = await redis.set(key, '1', 'PX', cooldownMs, 'NX');
  return res === 'OK';
}

/**
 * Try to acquire a simple lock (for beginBattle) with TTL (ms). Returns token if acquired, null if not.
 */
export async function acquireLock(lockName: string, ttlMs = 5000): Promise<string | null> {
  const token = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 8);
  const key = `lock:${lockName}`;
  const res = await redis.set(key, token, 'PX', ttlMs, 'NX');
  return res === 'OK' ? token : null;
}

/**
 * Release lock only if token matches (safe release).
 */
export async function releaseLock(lockName: string, token: string) {
  const key = `lock:${lockName}`;

  // Lua script compare-and-del
  const lua = `
    if redis.call("get", KEYS[1]) == ARGV[1]
    then
      return redis.call("del", KEYS[1])
    else
      return 0
    end
  `;

  try {
    await redis.eval(lua, 1, key, token);
  } catch (e) {
    // swallow; release best-effort
  }
}

export async function setBattleMember(playerId: string, battleId: string) {
  const memberBattleKey = `member:battle:${battleId}`;

  await redis.sadd(memberBattleKey, playerId);

  const members = await getBattleMembers(battleId);
  if (members.length === 1) {
    // Only set TTL if this was the first addition
    // 30 minutes
    await redis.expire(memberBattleKey, 60 * 30);
  }
}

export async function getBattleMembers(battleId: string): Promise<string[]> {
  // ['uuid-player-1', 'uuid-player-2', 'uuid-player-3']
  const memberBattleKey = `member:battle:${battleId}`;
  return redis.smembers(memberBattleKey);
}

export async function deleteBattleMembers(battleId: string): Promise<number> {
  const memberBattleKey = `member:battle:${battleId}`;
  return redis.del(memberBattleKey);
}

export async function updateLeaderboard(groupId: string, score: number) {
  const leaderboardKey = 'leaderboard:24h';

  // First time add key if not exist
  const added = await redis.zadd(leaderboardKey, 'NX', score, groupId);
  if (added) {
    // 24 hours
    await redis.expire(leaderboardKey, 24 * 60 * 60);
  } else {
    // Increment group score in the leaderboard
    await redis.zincrby(leaderboardKey, score, groupId); // increment existing
  }
}

export async function getLeaderboard(limit = 10) {
  const results = await redis.zrevrange('leaderboard:24h', 0, limit - 1, 'WITHSCORES');

  // results comes as [member1, score1, member2, score2, ...]
  const leaderboard = [];
  for (let i = 0; i < results.length; i += 2) {
    leaderboard.push({
      rank: i / 2 + 1,
      groupId: results[i],
      score: Number(results[i + 1]),
    });
  }

  return leaderboard;
}
