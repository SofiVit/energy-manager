import express, { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { authenticateToken } from '../middleware/auth.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Реєстрація користувача
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, max_power_limit_kw, tariff_type } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ message: "Ім'я, email та пароль є обов'язковими" });
    return;
  }

  try {
    const userExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      res.status(400).json({ message: 'Користувач з таким email вже існує' });
      return;
    }

    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    const newUser = await pool.query(
      `INSERT INTO users (name, email, password_hash, max_power_limit_kw, tariff_type) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, name, email, max_power_limit_kw, tariff_type, base_tariff_rate, language, currency, outage_group, outage_schedule`,
      [name, email, password_hash, max_power_limit_kw || 3.50, tariff_type || 'single']
    );

    const token = jwt.sign(
      { userId: newUser.rows[0].id }, 
      process.env.JWT_SECRET || 'secret', 
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Реєстрація успішна',
      user: newUser.rows[0],
      token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка сервера при реєстрації' });
  }
});

// Вхід користувача (Login)
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ message: "Email та пароль є обов'язковими" });
    return;
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      res.status(400).json({ message: 'Невірний email або пароль' });
      return;
    }

    const user = result.rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      res.status(400).json({ message: 'Невірний email або пароль' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id }, 
      process.env.JWT_SECRET || 'secret', 
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Вхід успішний',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        max_power_limit_kw: user.max_power_limit_kw,
        tariff_type: user.tariff_type,
        base_tariff_rate: user.base_tariff_rate,
        language: user.language,
        currency: user.currency,
        outage_group: user.outage_group,
        outage_schedule: user.outage_schedule
      },
      token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка сервера при вході' });
  }
});

// Отримати профіль поточного користувача (при перезавантаженні сторінки на фронтенді)
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, max_power_limit_kw, tariff_type, base_tariff_rate, language, currency, outage_group, outage_schedule 
       FROM users WHERE id = $1`,
      [req.user?.id]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Користувача не знайдено' });
      return;
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка отримання профілю' });
  }
});

// Оновити налаштування профілю (Settings + параметри тарифів/відключень у Planning)
router.patch('/settings', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const {
      name,
      email,
      max_power_limit_kw,
      tariff_type,
      base_tariff_rate,
      language,
      currency,
      outage_group,
      outage_schedule
    } = req.body;

    const currentRes = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (currentRes.rows.length === 0) {
      res.status(404).json({ message: 'Користувача не знайдено' });
      return;
    }
    const current = currentRes.rows[0];

    const updatedRes = await pool.query(
      `UPDATE users SET
        name = $1,
        email = $2,
        max_power_limit_kw = $3,
        tariff_type = $4,
        base_tariff_rate = $5,
        language = $6,
        currency = $7,
        outage_group = $8,
        outage_schedule = $9,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING id, name, email, max_power_limit_kw, tariff_type, base_tariff_rate, language, currency, outage_group, outage_schedule`,
      [
        name ?? current.name,
        email ?? current.email,
        max_power_limit_kw ?? current.max_power_limit_kw,
        tariff_type ?? current.tariff_type,
        base_tariff_rate ?? current.base_tariff_rate,
        language ?? current.language,
        currency ?? current.currency,
        outage_group !== undefined ? outage_group : current.outage_group,
        outage_schedule !== undefined ? JSON.stringify(outage_schedule) : JSON.stringify(current.outage_schedule),
        userId
      ]
    );

    res.json({
      message: 'Налаштування збережено',
      user: updatedRes.rows[0]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка оновлення налаштувань' });
  }
});

// Зміна пароля (кнопка Change Password у Settings)
router.patch('/password', authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      res.status(400).json({ message: 'Введіть поточний та новий паролі' });
      return;
    }

    const userRes = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      res.status(404).json({ message: 'Користувача не знайдено' });
      return;
    }

    const isValid = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
    if (!isValid) {
      res.status(400).json({ message: 'Невірний поточний пароль' });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newHash, userId]);

    res.json({ message: 'Пароль успішно змінено' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка зміни пароля' });
  }
});

export default router;