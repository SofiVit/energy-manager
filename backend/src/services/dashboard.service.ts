import { pool } from '../db';
import { env } from '../config/env';
import { getOutageStatus, minutesOfDayInTimeZone } from '../utils/outage';
import type { OutageStatus } from '../utils/outage';
import { notFound } from '../utils/errors';

const round = (value: number, digits: number): number => {
  const k = 10 ** digits;
  return Math.round((value + Number.EPSILON) * k) / k;
};

const toNumber = (value: unknown): number | null => {
  const n = typeof value === 'string' || typeof value === 'number' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
};

export interface Savings {
  cost_uah: number;
  energy_kwh: number;
}

/**
 * Економія = базовий (неоптимізований) сценарій мінус оптимізований.
 * Базовий сценарій очікується в schedules.schedule_data.baseline = { total_cost_uah, total_energy_kwh }
 * (контракт із Розробником 2, ALG/UI-02). Якщо baseline відсутній — економію порахувати неможливо.
 */
export function extractSavings(row: {
  total_energy_kwh: unknown;
  total_cost_uah: unknown;
  schedule_data: unknown;
}): Savings | null {
  const data = row.schedule_data as { baseline?: { total_cost_uah?: unknown; total_energy_kwh?: unknown } } | null;
  const baseCost = toNumber(data?.baseline?.total_cost_uah);
  const baseEnergy = toNumber(data?.baseline?.total_energy_kwh);
  const cost = toNumber(row.total_cost_uah);
  const energy = toNumber(row.total_energy_kwh);
  if (baseCost === null || baseEnergy === null || cost === null || energy === null) return null;
  return { cost_uah: round(baseCost - cost, 2), energy_kwh: round(baseEnergy - energy, 3) };
}

async function getUserOutageStatus(userId: string, now: Date): Promise<OutageStatus | null> {
  const result = await pool.query('SELECT outage_schedule FROM users WHERE id = $1', [userId]);
  if (result.rows.length === 0) throw notFound('Користувача не знайдено');
  return getOutageStatus(result.rows[0].outage_schedule, minutesOfDayInTimeZone(now, env.APP_TIMEZONE));
}

export async function getDashboardSummary(userId: string, now: Date = new Date()) {
  const [devices, batteries, schedule, nextOutage] = await Promise.all([
    pool.query(
      `SELECT COUNT(*)::int AS active_devices, COALESCE(SUM(power_watts), 0)::int AS total_power_watts
       FROM user_devices WHERE user_id = $1 AND is_active`,
      [userId],
    ),
    // Резерв = ємність АКБ та зарядних станцій; генератор має запас палива, а не ємність
    pool.query(
      `SELECT COALESCE(SUM(capacity_wh), 0)::int AS battery_reserve_wh
       FROM power_sources WHERE user_id = $1 AND type IN ('inverter_battery', 'station')`,
      [userId],
    ),
    pool.query(
      `SELECT id, strategy, to_char(schedule_date, 'YYYY-MM-DD') AS schedule_date, total_energy_kwh, total_cost_uah, schedule_data, created_at
       FROM schedules WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId],
    ),
    getUserOutageStatus(userId, now),
  ]);

  const { active_devices, total_power_watts } = devices.rows[0];
  const { battery_reserve_wh } = batteries.rows[0];
  const last = schedule.rows[0];

  return {
    active_devices: active_devices as number,
    total_power_watts: total_power_watts as number,
    total_power_kw: round(total_power_watts / 1000, 3),
    battery_reserve_wh: battery_reserve_wh as number,
    battery_reserve_kwh: round(battery_reserve_wh / 1000, 3),
    savings: last ? extractSavings(last) : null,
    last_schedule: last
      ? {
          id: last.id as string,
          strategy: last.strategy as string,
          schedule_date: last.schedule_date,
          total_energy_kwh: round(Number(last.total_energy_kwh), 3),
          total_cost_uah: round(Number(last.total_cost_uah), 2),
          created_at: last.created_at,
        }
      : null,
    next_outage: nextOutage,
    generated_at: now.toISOString(),
  };
}

/** UI-03: дані для Smart-сповіщень. Саме попередження формує фронтенд. */
export async function getNotificationsData(userId: string, now: Date = new Date()) {
  const [nextOutage, critical] = await Promise.all([
    getUserOutageStatus(userId, now),
    pool.query(
      `SELECT id, title, power_watts
       FROM user_devices
       WHERE user_id = $1 AND is_active AND NOT allow_backup_power
       ORDER BY power_watts DESC, title`,
      [userId],
    ),
  ]);

  const warnBefore = env.OUTAGE_WARN_BEFORE_MINUTES;
  return {
    next_outage: nextOutage,
    warn_before_minutes: warnBefore,
    // Підказка для UI: попередження потрібне, якщо відключення ще не почалось, але станеться найближчим часом
    should_warn:
      nextOutage !== null &&
      !nextOutage.is_active &&
      nextOutage.starts_in_minutes <= warnBefore &&
      critical.rows.length > 0,
    critical_devices: critical.rows as Array<{ id: string; title: string; power_watts: number }>,
    generated_at: now.toISOString(),
  };
}
