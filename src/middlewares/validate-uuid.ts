import type { Request, Response, NextFunction } from 'express';
import validator from 'validator';

export function validateUUID(req: Request, res: Response, next: NextFunction) {
  for (const [key, value] of Object.entries(req.params)) {
    if (key.toLowerCase().endsWith('id')) {
      if (!validator.isUUID(value)) {
        return res.status(400).json({ error: `Invalid UUID for param: ${key}` });
      }
    }
  }

  return next();
}
