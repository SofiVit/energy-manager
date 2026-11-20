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

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),

    DATABASE_URL: z.string().url().optional(),
    DB_HOST: z.string().min(1).default('localhost'),
    DB_PORT: z.coerce.number().int().min(1).max(65535).default(5432),
    DB_USER: z.string().min(1).default('postgres'),
    DB_PASSWORD: z.string().default(''),
    DB_NAME: z.string().min(1).default('energy_manager'),

    JWT_SECRET: z.string({ error: 'JWT_SECRET не задано' }).min(32, 'JWT_SECRET має містити щонайменше 32 символи'),
    JWT_EXPIRES_IN: z.string().default('7d'),

    APP_TIMEZONE: z
      .string()
      .default('Europe/Kyiv')
      .refine(isValidTimeZone, 'APP_TIMEZONE має бути коректним IANA-часовим поясом'),
    OUTAGE_WARN_BEFORE_MINUTES: z.coerce.number().int().min(1).max(120).default(15),
    CORS_ORIGIN: z.string().optional(),
  })
  .refine(
    (data) => data.NODE_ENV !== 'production' || Boolean(data.CORS_ORIGIN?.trim()),
    {
      message: 'CORS_ORIGIN є обов’язковим у production-режимі',
      path: ['CORS_ORIGIN'],
    },
  );

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((i) => `  - ${i.path.join('.') || 'env'}: ${i.message}`)
    .join('\n');
  throw new Error(`Некоректна конфігурація середовища:\n${details}`);
}

const raw = parsed.data;
const databaseUrl =
  raw.DATABASE_URL ??
  `postgresql://${encodeURIComponent(raw.DB_USER)}:${encodeURIComponent(raw.DB_PASSWORD)}@${raw.DB_HOST}:${raw.DB_PORT}/${raw.DB_NAME}`;

export const env = {
  ...raw,
  DATABASE_URL: databaseUrl,
};