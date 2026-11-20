import { createApp } from './app';
import { env } from './config/env';
import { pool } from './db';

const app = createApp();
const PORT = Number(process.env.PORT) || 5000;

// Перевірка з'єднання з БД при старті сервера
pool.query('SELECT NOW()')
  .then((res) => {
    console.log(`✅ Підключено до PostgreSQL (час БД: ${res.rows[0].now})`);
    app.listen(PORT, () => {
      console.log(`🚀 Сервер запущено на http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Помилка підключення до PostgreSQL:', err);
    process.exit(1);
  });