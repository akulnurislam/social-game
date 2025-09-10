import { AppException } from './app-exception';

export class GroupNotFoundException extends AppException {
  constructor(playerId: string) {
    super(`Group with id ${playerId} not found`, 404);
  }
}
