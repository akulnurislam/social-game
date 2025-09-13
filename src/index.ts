import { startTelegramBot } from './bot';
import { startApiServer } from './server';
import { startWsServer } from './ws-server';

// npm start api → arg = 'api'
const arg = process.argv[2];

switch (arg) {
  case 'api':
    startApiServer();
    break;

  case 'ws':
    startWsServer();
    break;

  case 'bot':
    startTelegramBot();
    break;

  case undefined:
    // No param → start all
    startApiServer();
    startWsServer();
    startTelegramBot();
    break;

  default:
    console.error(`Unknown option '${arg}'. Use 'api' or 'ws' or 'bot'`);
    process.exit(1);
}
