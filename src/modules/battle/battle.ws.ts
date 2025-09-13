import { WebSocket } from 'ws';
import { pool } from '../../core/db';
import { PlayerRepository } from '../player/player.repository';
import { PlayerService } from '../player/player.service';

const repo = new PlayerRepository(pool);
const service = new PlayerService(repo);

// --- Incoming (Client → Server) ---
export function handleBattleWsMessage(ws: WebSocket, raw: string) {
  try {
    console.log(`[Battle Handler] message received: ${raw}`);
  } catch (err) {
    ws.send(JSON.stringify({ error: (err as Error).message }));
  }
}

// --- Outgoing (Server → Client) ---
export function send(ws: WebSocket, player: any) {
  ws.send(JSON.stringify({ event: 'playerMe', payload: player }));
}

export function sendPlayerCreated(ws: WebSocket, player: any) {
  ws.send(JSON.stringify({ event: 'playerCreated', payload: player }));
}