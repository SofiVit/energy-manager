import { Router } from 'express';
import type { Response } from 'express';
import { pool } from '../db';
import { authenticateToken } from '../middleware/auth.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { createSourceSchema, updateSourceSchema } from '../schemas/source.schemas';
import { uuidParam } from '../schemas/common';
import { badRequest, notFound } from '../utils/errors';
import { buildUpdate } from '../utils/sql';

const router = Router();

const UPDATE_COLUMNS = [
  'title',
  'type',
  'capacity_wh',
  'max_output_watts',
  'charge_time_minutes',
] as const;

const SELECT_COLUMNS = `
  id, user_id, title, type, capacity_wh, max_output_watts,
  charge_time_minutes, created_at, updated_at
`;

async function listUserSources(req: AuthRequest, res: Response) {
  const result = await pool.query(
    `SELECT ${SELECT_COLUMNS}
     FROM power_sources
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [req.user?.id],
  );
  res.json(result.rows);
}

// Підтримуємо обидва варіанти (/api/sources та /api/sources/my) для зручності фронтенду
router.get('/', authenticateToken, listUserSources);
router.get('/my', authenticateToken, listUserSources);

router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  const s = createSourceSchema.parse(req.body);

  const result = await pool.query(
    `INSERT INTO power_sources (user_id, title, type, capacity_wh, max_output_watts, charge_time_minutes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${SELECT_COLUMNS}`,
    [
      req.user?.id,
      s.title,
      s.type,
      s.capacity_wh ?? 0,
      s.max_output_watts,
      s.charge_time_minutes ?? null,
    ],
  );

  res.status(201).json(result.rows[0]);
});

router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = uuidParam.parse(req.params);
  const s = updateSourceSchema.parse(req.body);

  const update = buildUpdate(UPDATE_COLUMNS, s);
  if (!update) throw badRequest('Не передано жодного поля для оновлення');

  const result = await pool.query(
    `UPDATE power_sources SET ${update.setClause}
     WHERE id = $${update.values.length + 1} AND user_id = $${update.values.length + 2}
     RETURNING ${SELECT_COLUMNS}`,
    [...update.values, id, req.user?.id],
  );

  if (result.rows.length === 0) throw notFound('Джерело живлення не знайдено');

  res.json(result.rows[0]);
});

router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { id } = uuidParam.parse(req.params);

  const result = await pool.query(
    'DELETE FROM power_sources WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, req.user?.id],
  );

  if (result.rows.length === 0) {
    throw notFound('Джерело живлення не знайдено або немає прав на видалення');
  }

  res.json({ message: 'Джерело живлення успішно видалено', id });
});

export default router;