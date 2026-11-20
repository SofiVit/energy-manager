import 'dotenv/config';
import { z } from 'zod';

const isValidTimeZone = (tz: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // Секрет підпису JWT. Значення за замовчуванням навмисно немає.
  JWT_SECRET: z.string({ error: 'JWT_SECRET не задано' }).min(32, 'JWT_SECRET має містити щонайменше 32 символи'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  // Часовий пояс, у якому інтерпретується outage_schedule користувача.
  APP_TIMEZONE: z
    .string()
    .default('Europe/Kyiv')
    .refine(isValidTimeZone, 'APP_TIMEZONE має бути коректним IANA-часовим поясом'),
  // За скільки хвилин до відключення фронтенд показує попередження (UI-03).
  OUTAGE_WARN_BEFORE_MINUTES: z.coerce.number().int().min(1).max(120).default(15),
  // Дозволені origin для CORS через кому. Порожнє значення = усі (лише для розробки).
  CORS_ORIGIN: z.string().optional(),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || 'env'}: ${i.message}`)
    .join('\n');
  throw new Error(`Некоректна конфігурація середовища:\n${details}`);
}

export const env = parsed.data;
