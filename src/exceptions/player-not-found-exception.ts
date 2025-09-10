import { AppException } from './app-exception';

export class PlayerNotFoundException extends AppException {
  constructor(playerId: string) {
    super(`Player with id ${playerId} not found`, 404);
  }
}
