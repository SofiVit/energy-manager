import express, { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../db';

const router = Router();

// Реєстрація користувача
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { name, email, password, max_power_limit_kw, tariff_type } = req.body;

  if (!name || !email || !password) {
    res.status(400).json({ message: "Ім'я, email та пароль є обов'язковими" });
    return;
  }

  try {
    // Перевірка, чи існує користувач
    const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      res.status(400).json({ message: 'Користувач з таким email вже існує' });
      return;
    }

    // Хешування пароля
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Збереження в БД
    const newUser = await pool.query(
      `INSERT INTO users (name, email, password_hash, max_power_limit_kw, tariff_type) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, name, email, max_power_limit_kw, tariff_type`,
      [name, email, password_hash, max_power_limit_kw || 3.50, tariff_type || 'single']
    );

    // Генерація JWT токена
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
        tariff_type: user.tariff_type
      },
      token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка сервера при вході' });
  }
});

export default router;