import express, { Router } from 'express';
import type { Response } from 'express';
import { pool } from '../db';
import { mapNumberToPriority, mapPriorityToNumber } from '../utils/mappers';
import { authenticateToken } from '../middleware/auth.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// ==========================================
// 1. ПУБЛІЧНІ ДОВІДНИКИ (Категорії та Пресети)
// ==========================================

router.get('/categories', async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.query.lang === 'en' ? 'en' : 'uk';
    const nameColumn = lang === 'en' ? 'COALESCE(name_en, name)' : 'name';

    const result = await pool.query(`
      SELECT id, ${nameColumn} as name, icon_name 
      FROM categories 
      ORDER BY id
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ message: 'Помилка отримання категорій' });
  }
});

router.get('/presets', async (req: AuthRequest, res: Response) => {
  try {
    const lang = req.query.lang === 'en' ? 'en' : 'uk';
    const titleColumn = lang === 'en' ? 'COALESCE(dp.title_en, dp.title)' : 'dp.title';
    const categoryNameColumn = lang === 'en' ? 'COALESCE(c.name_en, c.name)' : 'c.name';

    const result = await pool.query(`
      SELECT 
        dp.id, 
        dp.category_id, 
        ${titleColumn} as title, 
        ${categoryNameColumn} as category_name,
        dp.power_watts,
        dp.priority,
        dp.operating_mode,
        dp.avg_duration_minutes,
        dp.allow_backup_power
      FROM device_presets dp
      JOIN categories c ON dp.category_id = c.id
      ORDER BY dp.id
    `);
    
    const formattedPresets = result.rows.map(preset => ({
      ...preset,
      priority: mapNumberToPriority(preset.priority)
    }));

    res.json(formattedPresets);
  } catch (err) {
    res.status(500).json({ message: 'Помилка отримання пресетів приладів' });
  }
});

// ==========================================
// 2. ПРИЛАДИ КОРИСТУВАЧА (CRUD)
// ==========================================

// Отримати всі прилади поточного користувача
router.get('/my', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const lang = req.query.lang === 'en' ? 'en' : 'uk';
    const categoryNameColumn = lang === 'en' ? 'COALESCE(c.name_en, c.name)' : 'c.name';

    const result = await pool.query(`
      SELECT 
        ud.id,
        ud.preset_id,
        ud.category_id,
        ${categoryNameColumn} as category_name,
        ud.title,
        ud.power_watts,
        ud.priority,
        ud.operating_mode,
        ud.avg_duration_minutes,
        ud.allow_backup_power,
        ud.is_active,
        ud.created_at
      FROM user_devices ud
      LEFT JOIN categories c ON ud.category_id = c.id
      WHERE ud.user_id = $1
      ORDER BY ud.created_at DESC
    `, [userId]);

    const formattedDevices = result.rows.map(device => ({
      ...device,
      priority: mapNumberToPriority(device.priority),
      duration_hours: Number((device.avg_duration_minutes / 60).toFixed(2))
    }));

    res.json(formattedDevices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка отримання приладів користувача' });
  }
});

// Додати новий прилад користувачу
router.post('/my', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const { 
      preset_id = null,
      category_id = null,
      title, 
      power_watts, 
      priority = 'medium', 
      operating_mode = 'flexible', 
      avg_duration_minutes,
      duration_hours,
      allow_backup_power = false 
    } = req.body;

    if (!title || !power_watts) {
      res.status(400).json({ message: 'Назва приладу та потужність обов’язкові' });
      return;
    }

    let finalDurationMinutes = 60;
    if (avg_duration_minutes !== undefined) {
      finalDurationMinutes = Number(avg_duration_minutes);
    } else if (duration_hours !== undefined) {
      finalDurationMinutes = Math.round(Number(duration_hours) * 60);
    }

    const priorityNum = mapPriorityToNumber(priority);

    const result = await pool.query(`
      INSERT INTO user_devices (
        user_id, preset_id, category_id, title, power_watts, 
        priority, operating_mode, avg_duration_minutes, allow_backup_power
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      userId, 
      preset_id, 
      category_id, 
      title, 
      Number(power_watts), 
      priorityNum, 
      operating_mode, 
      finalDurationMinutes, 
      Boolean(allow_backup_power)
    ]);

    const created = result.rows[0];
    res.status(201).json({
      ...created,
      priority: mapNumberToPriority(created.priority),
      duration_hours: Number((created.avg_duration_minutes / 60).toFixed(2))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка при додаванні приладу' });
  }
});

// Оновити існуючий прилад
router.patch('/my/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const deviceId = req.params.id;
    const { 
      title, 
      category_id,
      power_watts, 
      priority, 
      operating_mode, 
      avg_duration_minutes,
      duration_hours,
      allow_backup_power,
      is_active 
    } = req.body;

    const existing = await pool.query(
      'SELECT * FROM user_devices WHERE id = $1 AND user_id = $2',
      [deviceId, userId]
    );

    if (existing.rows.length === 0) {
      res.status(404).json({ message: 'Прилад не знайдено' });
      return;
    }

    const current = existing.rows[0];

    let updatedDuration = current.avg_duration_minutes;
    if (avg_duration_minutes !== undefined) updatedDuration = Number(avg_duration_minutes);
    else if (duration_hours !== undefined) updatedDuration = Math.round(Number(duration_hours) * 60);

    const updatedPriority = priority !== undefined ? mapPriorityToNumber(priority) : current.priority;

    const result = await pool.query(`
      UPDATE user_devices
      SET 
        title = $1,
        category_id = $2,
        power_watts = $3,
        priority = $4,
        operating_mode = $5,
        avg_duration_minutes = $6,
        allow_backup_power = $7,
        is_active = $8
      WHERE id = $9 AND user_id = $10
      RETURNING *
    `, [
      title ?? current.title,
      category_id !== undefined ? category_id : current.category_id,
      power_watts !== undefined ? Number(power_watts) : current.power_watts,
      updatedPriority,
      operating_mode ?? current.operating_mode,
      updatedDuration,
      allow_backup_power !== undefined ? Boolean(allow_backup_power) : current.allow_backup_power,
      is_active !== undefined ? Boolean(is_active) : current.is_active,
      deviceId,
      userId
    ]);

    const updated = result.rows[0];
    res.json({
      ...updated,
      priority: mapNumberToPriority(updated.priority),
      duration_hours: Number((updated.avg_duration_minutes / 60).toFixed(2))
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка при оновленні приладу' });
  }
});

// Видалити прилад користувача
router.delete('/my/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const deviceId = req.params.id;

    const result = await pool.query(
      'DELETE FROM user_devices WHERE id = $1 AND user_id = $2 RETURNING id',
      [deviceId, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ message: 'Прилад не знайдено або немає прав на видалення' });
      return;
    }

    res.json({ message: 'Прилад успішно видалено', id: deviceId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Помилка при видаленні приладу' });
  }
});

export default router;