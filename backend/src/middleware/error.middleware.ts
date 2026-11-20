import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ message: 'Маршрут не знайдено' });
};

interface PgLikeError {
  code?: string;
  constraint?: string;
}

const isPgError = (err: unknown): err is PgLikeError =>
  typeof err === 'object' && err !== null && typeof (err as PgLikeError).code === 'string' && (err as PgLikeError).code!.length === 5;

/**
 * Єдина точка обробки помилок. Формат відповіді завжди містить `message`
 * (як і раніше), для валідації додатково — масив `errors`.
 */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof ZodError) {
    const errors = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    res.status(400).json({ message: errors[0]?.message ?? 'Некоректні дані', errors });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.status).json({ message: err.message, ...(err.code ? { code: err.code } : {}) });
    return;
  }

  // Некоректний JSON у тілі запиту (body-parser)
  if (err && typeof err === 'object' && (err as { type?: string }).type === 'entity.parse.failed') {
    res.status(400).json({ message: 'Некоректний JSON у тілі запиту' });
    return;
  }

  if (isPgError(err)) {
    switch (err.code) {
      case '23505': // unique_violation
        if (err.constraint === 'users_email_key') {
          res.status(409).json({ message: 'Користувач з таким email вже існує', code: 'CONFLICT' });
        } else {
          res.status(409).json({ message: 'Такий запис уже існує', code: 'CONFLICT' });
        }
        return;
      case '23503': // foreign_key_violation
        res.status(400).json({ message: 'Пов’язаний запис (категорія або пресет) не знайдено' });
        return;
      case '22P02': // invalid_text_representation (наприклад, некоректний UUID)
      case '22003': // numeric_value_out_of_range
      case '23514': // check_violation
        res.status(400).json({ message: 'Некоректні дані запиту' });
        return;
    }
  }

  console.error(`[${req.method} ${req.originalUrl}]`, err);
  res.status(500).json({ message: 'Внутрішня помилка сервера' });
};
