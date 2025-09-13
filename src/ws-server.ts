import { parse } from 'url';
import validator from 'validator';
import { WebSocket, WebSocketServer } from 'ws';
import {
  CHANNEL_BATTLE_BEGIN,
  CHANNEL_BATTLE_FINISHED,
  CHANNEL_BATTLE_JOIN,
} from './constants/redis-channels';
import { pool } from './core/db';
import { redisSubscriber } from './core/redis';
import { PlayerNotFoundException } from './exceptions/player-not-found-exception';
import { handleBattleWsMessage } from './modules/battle/battle.ws';
import { PlayerRepository } from './modules/player/player.repository';
import { PlayerService } from './modules/player/player.service';
import { getBattleMembers, getLeaderboard } from './utils/redis-utils';

const PORT = process.env['WS_PORT'] || 4000;

const PLAYERS = new Map<string, WebSocket>();

const playerRepository = new PlayerRepository(pool);
const playerService = new PlayerService(playerRepository);

export async function startWsServer() {
  const wss = new WebSocketServer({ port: Number(PORT) });

  wss.on('connection', async (ws: WebSocket, req: any) => {
    try {
      const { query } = parse(req.url || '', true);
      const playerId = query['playerId'] as string;

      if (!playerId) {
        ws.close(1008, 'playerId required');
        return;
      }

      if (!validator.isUUID(playerId)) {
        ws.close(1008, 'Invalid UUID');
        return;
      }

      // Validate user
      await playerService.getPlayerById(playerId);
      console.log(`[WS Server] client connected: ${playerId}`);

      PLAYERS.set(playerId, ws);

      // Welcoming message with leaderbord event
      const leaderboard = await getLeaderboard();
      ws.send(JSON.stringify({
        event: 'leaderboard',
        payload: leaderboard,
      }));

      ws.on('message', (msg) => {
        console.log(`[WS Server] [${playerId}] message received`);

        let parsed: { event: string; payload?: any };
        try {
          parsed = JSON.parse(msg.toString());
        } catch (err) {
          console.warn(`[WS Server] [${playerId}] Invalid JSON ignored:`, msg.toString());
          // ignore invalid JSON but keep connection alive
          return;
        }

        switch (parsed.event) {
          case 'ping':
            ws.send(JSON.stringify({ event: 'pong' }));
            break;

          case 'battle':
            handleBattleWsMessage(ws, msg.toString());
            break;

          default:
            console.log('Unknown event:', parsed);
        }
      });

      ws.on('close', () => {
        PLAYERS.delete(playerId);
        console.log(`[WS Server] client disconnected: ${playerId}`);
      });

    } catch (err: any) {
      console.error('[WS Server] connection error', err);
      if (err instanceof PlayerNotFoundException) {
        ws.close(1011, err.message);
        return;
      }
      ws.close(1011, 'Internal server error');
    }
  });

  console.log(`[WS Server] running on ws://localhost:${PORT}`);

  redisSubscriber.subscribe(CHANNEL_BATTLE_BEGIN, CHANNEL_BATTLE_JOIN, CHANNEL_BATTLE_FINISHED, (err, count) => {
    if (err) {
      // should be exit, becuase we're relying on pub/sub
      console.error('[Redis Subscriber] Failed to subscribe: %s', err.message);
    } else {
      console.log(`[Redis Subscriber] subscribed to ${count} channels`);
    }
  });

  redisSubscriber.on('message', async (channel, message) => {
    let payload: { battleId: string; playerId?: string; winnerGroupId?: string; score?: number };
    try {
      payload = JSON.parse(message);
    } catch (e) {
      console.error(`[Redis Subscriber] invalid message on ${channel} ${message}`);
      return;
    }

    switch (channel) {
      case CHANNEL_BATTLE_BEGIN:
      case CHANNEL_BATTLE_JOIN:
        notifyBattlePlayers(payload.battleId, {
          event: channel,
          payload,
        });
        break;

      case CHANNEL_BATTLE_FINISHED:
        notifyBattlePlayers(payload.battleId, {
          event: channel,
          payload,
        });

        // Broadcast leaderboard to all connected players
        const leaderboard = await getLeaderboard();
        broadcastAll({
          event: 'leaderboard',
          payload: leaderboard,
        });
        break;
    }
  });
}

async function notifyBattlePlayers(battleId: string, message: any) {
  const battleMembers = await getBattleMembers(battleId);
  for (const member of battleMembers) {
    const ws = PLAYERS.get(member);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}

function broadcastAll(message: any) {
  for (const ws of PLAYERS.values()) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
}
