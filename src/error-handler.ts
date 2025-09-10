import type { Request, Response, NextFunction } from 'express';
import { AppException } from './exceptions/app-exception';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);

  if (err instanceof AppException) {
    return res.status(err.status).json({ error: err.message });
  }

  // Handle Postgres unique violation
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Resource already exists' });
  }

  // Handle invalid UUID errors from Postgres
  if (err.code === '22P02') {
    return res.status(400).json({ error: 'Invalid UUID format' });
  }

  // Handle foreign key constraint violation
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Invalid reference to another resource' });
  }

  // More Postgres error codes here if needed
  // Or other errors

  return res.status(500).json({ error: 'Internal server error' });
}
