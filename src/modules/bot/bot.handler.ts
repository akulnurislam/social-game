import type TelegramBot from 'node-telegram-bot-api';
import { pool } from '../../core/db';
import { PlayerRepository } from '../player/player.repository';
import { PlayerService } from '../player/player.service';

const playerRepository = new PlayerRepository(pool);
const playerService = new PlayerService(playerRepository);

export async function handlePlayerCommand(bot: TelegramBot, msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  const username = msg.from?.username || msg.from?.first_name || null;
  const telegramId = msg.from?.id;

  if (!telegramId) {
    console.warn('No telegram_id found(channel post or anonymous admin): ', msg);
    return;
  }

  try {
    if (username === null) {
      bot.sendMessage(chatId, 'You must set a Telegram username to create a player!');
      return;
    }

    const player = await playerService.getPlayerByTelegramId(telegramId);
    if (player) {
      bot.sendMessage(chatId, `You've become a player ${player.username}, let's play!`);
      return;
    }

    const createdPlayer = await playerService.createPlayer(username, telegramId);
    if (!createdPlayer) {
      throw new Error('Cannot create player');
    }

    bot.sendMessage(chatId, `You just became a player ${username}, let's play!`);
  } catch (e) {
    console.error(e);
    bot.sendMessage(chatId, "Failed to create player");
  }
}
