import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './db';

import authRoutes from './routes/auth.routes';
import deviceRoutes from './routes/device.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Підключення маршрутів API
app.use('/api/auth', authRoutes);
app.use('/api/devices', deviceRoutes);

// Healthcheck
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      status: 'ok', 
      message: 'Energy Manager API працює!', 
      db_time: result.rows[0].now 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Помилка підключення до БД' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущено на http://localhost:${PORT}`);
});