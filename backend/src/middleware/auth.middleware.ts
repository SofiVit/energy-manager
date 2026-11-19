// src/middleware/auth.middleware.ts
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Дістаємо токен після "Bearer "

  if (!token) {
    res.status(401).json({ message: 'Немає доступу: відсутній токен авторизації' });
    return;
  }

  try {
    // Використовуємо той самий запасний ключ 'secret', що і в auth.routes.ts
    const secret = process.env.JWT_SECRET || 'secret';
    const decoded = jwt.verify(token, secret) as { userId?: string; id?: string };
    
    const extractedId = decoded.userId || decoded.id;

    if (!extractedId) {
      res.status(403).json({ message: 'Некоректна структура токена' });
      return;
    }

    // Записуємо у req.user.id, щоб усі інші роути (device.routes.ts тощо) працювали без змін
    req.user = { id: extractedId };
    next();
  } catch (err) {
    res.status(403).json({ message: 'Недійсний або прострочений токен' });
  }
};