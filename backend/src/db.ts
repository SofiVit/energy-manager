import { Pool } from 'pg';
import { env } from './config/env';

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

pool.on('connect', () => {
  if (env.NODE_ENV !== 'test') {
    console.log('⚡ Успішно підключено до бази даних PostgreSQL');
  }
});

pool.on('error', (err) => {
  console.error('❌ Помилка підключення до бази даних:', err);
});