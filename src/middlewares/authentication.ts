import type { Request, Response, NextFunction } from 'express';
import validator from 'validator';

export function authenticatePlayer(req: Request, res: Response, next: NextFunction) {
  // Skip header validation for player creation
  if (req.method === 'POST' && req.path === '/players') {
    return next();
  }

  const playerId = req.header('X-Player-ID');
  if (!playerId) {
    return res.status(400).json({ error: 'Missing required header: X-Player-ID' });
  }
  if (!validator.isUUID(playerId)) {
    return res.status(400).json({ error: 'Invalid UUID for header: X-Player-ID' });
  }

  req.playerId = playerId;
  next();
}
