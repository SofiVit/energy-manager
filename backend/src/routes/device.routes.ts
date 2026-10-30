import express, { Router } from 'express';
import type { Request, Response } from 'express';
import { pool } from '../db';

const router = Router();

// Отримати всі категорії приладів
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Помилка отримання категорій' });
  }
});

// Отримати довідник готових приладів (presets)
router.get('/presets', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT dp.*, c.name as category_name 
      FROM device_presets dp
      JOIN categories c ON dp.category_id = c.id
      ORDER BY dp.id
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Помилка отримання пресетів приладів' });
  }
});

export default router;