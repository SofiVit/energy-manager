import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env';
import { unauthorized } from '../utils/errors';

export interface AuthRequest extends Request {
  user?: { id: string };
}

const PayloadSchema = z.object({ userId: z.uuid() });

export function authenticateToken(req: AuthRequest, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const [scheme, token] = header?.split(' ') ?? [];

  if (scheme !== 'Bearer' || !token) {
    return next(unauthorized('Потрібен токен авторизації'));
  }

  try {
    const payload = PayloadSchema.parse(jwt.verify(token, env.JWT_SECRET));
    req.user = { id: payload.userId };
    next();
  } catch {
    next(unauthorized('Недійсний або прострочений токен'));
  }
}
