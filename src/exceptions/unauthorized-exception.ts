import { AppException } from './app-exception';

export class UnauthorizedException extends AppException {
  constructor(playerId: string) {
    super(`Unauthorized player with id ${playerId}`, 401);
  }
}
