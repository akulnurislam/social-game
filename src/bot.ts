import TelegramBot from 'node-telegram-bot-api';
import { handlePlayerCommand } from './modules/bot/bot.handler';


const TELEGRAM_TOKEN = process.env['TELEGRAM_TOKEN'];

export async function startTelegramBot() {
  const bot = new TelegramBot(TELEGRAM_TOKEN!, { polling: true });

  bot.on('message', (msg) => {
    if (msg.text && msg.text.startsWith('/')) return;
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'We got your message.');
  });

  // Define command handlers
  bot.onText(/\/player/, (msg) => handlePlayerCommand(bot, msg));

  bot.on('polling_error', (err: any) => {
    console.error(`[Telegram BOT]`, err.message);
    bot.stopPolling();
  });

  bot.on('webhook_error', (err: any) => {
    console.error(`[Telegram BOT]`, err.message);
    bot.closeWebHook();
  });

  try {
    await bot.setMyCommands([
      { command: 'player', description: 'Create a player' },
    ]);
    console.log(`[Telegram BOT] running`);
  } catch (_err) {
    console.error(`[Telegram BOT] error`);
  }
}
