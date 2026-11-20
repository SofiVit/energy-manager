import { Router } from 'express';
import type { Response } from 'express';
import { pool } from '../db';
import { authenticateToken } from '../middleware/auth.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { mapNumberToPriority, mapPriorityToNumber } from '../utils/mappers';
import { createDeviceSchema, updateDeviceSchema } from '../schemas/device.schemas';
import { langSchema, uuidParam } from '../schemas/common';
import { badRequest, notFound } from '../utils/errors';
import { buildUpdate } from '../utils/sql';

const router = Router();

const UPDATE_COLUMNS = [
  'title',
  'category_id',
  'power_watts',
  'priority',
  'operating_mode',
  'avg_duration_minutes',
  'allow_backup_power',
  'is_active',
] as const;

// ==========================================
// 1. ПУБЛІЧНІ ДОВІДНИКИ (Категорії та Пресети)
// ==========================================

router.get('/categories', async (req, res: Response) => {
  const lang = langSchema.parse(req.query.lang);
  const nameColumn = lang === 'en' ? 'COALESCE(name_en, name)' : 'name';

  const result = await pool.query(`SELECT id, ${nameColumn} AS name, icon_name FROM categories ORDER BY id`);
  res.json(result.rows);
});

router.get('/presets', async (req, res: Response) => {
  const lang = langSchema.parse(req.query.lang);
  const titleColumn = lang === 'en' ? 'COALESCE(dp.title_en, dp.title)' : 'dp.title';
  const categoryNameColumn = lang === 'en' ? 'COALESCE(c.name_en, c.name)' : 'c.name';

  const result = await pool.query(`
    SELECT dp.id, dp.category_id, ${titleColumn} AS title, ${categoryNameColumn} AS category_name,
           dp.power_watts, dp.priority, dp.operating_mode, dp.avg_duration_minutes, dp.allow_backup_power
    FROM device_presets dp
    JOIN categories c ON dp.category_id = c.id
    ORDER BY dp.id
  `);

  res.json(result.rows.map((p) => ({ ...p, priority: mapNumberToPriority(p.priority) })));
});

// ==========================================
// 2. ПРИЛАДИ КОРИСТУВАЧА (CRUD)
// ==========================================

type DeviceRow = { priority: number; avg_duration_minutes: number } & Record<string, unknown>;

const toDeviceDto = (d: DeviceRow) => ({
  ...d,
  priority: mapNumberToPriority(d.priority),
  duration_hours: Number((d.avg_duration_minutes / 60).toFixed(2)),
});

/** Один і той самий набір полів для списку, створення та оновлення. */
const selectDevices = (lang: 'uk' | 'en', where: string) => `
  SELECT ud.id, ud.preset_id, ud.category_id,
         ${lang === 'en' ? 'COALESCE(c.name_en, c.name)' : 'c.name'} AS category_name,
         ud.title, ud.power_watts, ud.priority, ud.operating_mode, ud.avg_duration_minutes,
         ud.allow_backup_power, ud.is_active, ud.created_at
  FROM user_devices ud
  LEFT JOIN categories c ON ud.category_id = c.id
  WHERE ${where}`;

router.get('/my', authenticateToken, async (req: AuthRequest, res: Response) => {
  const lang = langSchema.parse(req.query.lang);
  const result = await pool.query(`${selectDevices(lang, 'ud.user_id = $1')} ORDER BY ud.created_at DESC`, [
    req.user?.id,
  ]);
  res.json(result.rows.map(toDeviceDto));
});

router.post('/my', authenticateToken, async (req: AuthRequest, res: Response) => {
  const lang = langSchema.parse(req.query.lang);
  const d = createDeviceSchema.parse(req.body);

  const inserted = await pool.query(
    `INSERT INTO user_devices
       (user_id, preset_id, category_id, title, power_watts, priority, operating_mode, avg_duration_minutes, allow_backup_power)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      req.user?.id,
      d.preset_id,
      d.category_id,
      d.title,
      d.power_watts,
      mapPriorityToNumber(d.priority),
      d.operating_mode,
      d.avg_duration_minutes,
      d.allow_backup_power,
    ],
  );

  const created = await pool.query(selectDevices(lang, 'ud.id = $1'), [inserted.rows[0].id]);
  res.status(201).json(toDeviceDto(created.rows[0]));
});

router.patch('/my/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = uuidParam.parse(req.params);
  const lang = langSchema.parse(req.query.lang);
  const d = updateDeviceSchema.parse(req.body);

  const update = buildUpdate(
    UPDATE_COLUMNS,
    { ...d, priority: d.priority !== undefined ? mapPriorityToNumber(d.priority) : undefined },
  );
  if (!update) throw badRequest('Не передано жодного поля для оновлення');

  const result = await pool.query(
    `UPDATE user_devices SET ${update.setClause}
     WHERE id = $${update.values.length + 1} AND user_id = $${update.values.length + 2}
     RETURNING id`,
    [...update.values, id, req.user?.id],
  );
  if (result.rows.length === 0) throw notFound('Прилад не знайдено');

  const updated = await pool.query(selectDevices(lang, 'ud.id = $1'), [id]);
  res.json(toDeviceDto(updated.rows[0]));
});

router.delete('/my/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = uuidParam.parse(req.params);

  const result = await pool.query('DELETE FROM user_devices WHERE id = $1 AND user_id = $2 RETURNING id', [
    id,
    req.user?.id,
  ]);
  if (result.rows.length === 0) throw notFound('Прилад не знайдено або немає прав на видалення');

  res.json({ message: 'Прилад успішно видалено', id });
});

export default router;
