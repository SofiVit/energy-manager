import { z } from 'zod';
import { numeric } from './common';

const priority = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.enum(['low', 'medium', 'high'], { error: 'Пріоритет має бути low, medium або high' }),
);

const operatingMode = z.enum(['continuous', 'scheduled', 'flexible'], {
  error: 'Режим роботи має бути continuous, scheduled або flexible',
});

const title = z.string({ error: 'Назва приладу обов’язкова' }).trim().min(1, 'Назва приладу обов’язкова').max(150, 'Назва занадто довга');

const powerWatts = numeric(
  z.number({ error: 'Потужність має бути числом' })
    .int('Потужність має бути цілим числом (Вт)')
    .positive('Потужність має бути більше 0')
    .max(100_000, 'Потужність занадто велика'),
);

const durationMinutes = numeric(
  z.number({ error: 'Тривалість має бути числом' })
    .int('Тривалість у хвилинах має бути цілим числом')
    .min(1, 'Тривалість має бути не менше 1 хвилини')
    .max(1440, 'Тривалість не може перевищувати 24 години'),
);

const durationHours = numeric(
  z.number({ error: 'Тривалість має бути числом' })
    .min(1 / 60, 'Тривалість має бути не менше 1 хвилини')
    .max(24, 'Тривалість не може перевищувати 24 години'),
);

const fk = z.number().int().positive();

/** Перетворює duration_hours у хвилини; avg_duration_minutes має пріоритет, якщо передано обидва. */
const resolveMinutes = (d: { avg_duration_minutes?: number; duration_hours?: number }): number | undefined =>
  d.avg_duration_minutes ?? (d.duration_hours !== undefined ? Math.max(1, Math.round(d.duration_hours * 60)) : undefined);

export const createDeviceSchema = z
  .object({
    preset_id: fk.nullable().optional(),
    category_id: fk.nullable().optional(),
    title,
    power_watts: powerWatts,
    priority: priority.optional(),
    operating_mode: operatingMode.optional(),
    avg_duration_minutes: durationMinutes.optional(),
    duration_hours: durationHours.optional(),
    allow_backup_power: z.boolean({ error: 'allow_backup_power має бути true або false' }).optional(),
  })
  .transform((d) => ({
    preset_id: d.preset_id ?? null,
    category_id: d.category_id ?? null,
    title: d.title,
    power_watts: d.power_watts,
    priority: d.priority ?? 'medium',
    operating_mode: d.operating_mode ?? 'flexible',
    avg_duration_minutes: resolveMinutes(d) ?? 60,
    allow_backup_power: d.allow_backup_power ?? false,
  }));

export const updateDeviceSchema = z
  .object({
    category_id: fk.nullable().optional(),
    title: title.optional(),
    power_watts: powerWatts.optional(),
    priority: priority.optional(),
    operating_mode: operatingMode.optional(),
    avg_duration_minutes: durationMinutes.optional(),
    duration_hours: durationHours.optional(),
    allow_backup_power: z.boolean({ error: 'allow_backup_power має бути true або false' }).optional(),
    is_active: z.boolean({ error: 'is_active має бути true або false' }).optional(),
  })
  .transform((d) => ({
    category_id: d.category_id,
    title: d.title,
    power_watts: d.power_watts,
    priority: d.priority,
    operating_mode: d.operating_mode,
    avg_duration_minutes: resolveMinutes(d),
    allow_backup_power: d.allow_backup_power,
    is_active: d.is_active,
  }))
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'Не передано жодного поля для оновлення',
  });
