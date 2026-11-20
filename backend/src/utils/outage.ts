/**
 * Графік відключень користувача (users.outage_schedule, JSONB) вводиться вручну.
 *
 * Підтримувані формати елементів масиву:
 *   1) "HH:00"                      — годинний слот [HH:00; HH+1:00), так працює сітка на екрані Parameters;
 *   2) { start: "HH:MM", end: "HH:MM" } — інтервал; кінець не включається; якщо end <= start,
 *      інтервал переходить через північ (наприклад 22:00–02:00).
 *
 * Усі обчислення ведуться в хвилинах від початку доби (0..1439) у часовому поясі APP_TIMEZONE.
 * Цей модуль — спільний контракт: його має використовувати і ALG-03 (Розробник 2).
 */

export const MINUTES_IN_DAY = 1440;

export const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const HOUR_SLOT_RE = /^([01]\d|2[0-3]):00$/;

export type OutageItem = string | { start: string; end: string };

export interface OutageStatus {
  /** Відключення діє просто зараз */
  is_active: boolean;
  /** Початок відключення "HH:MM" (для активного — початок поточного відключення) */
  start: string;
  /** Кінець відключення "HH:MM" */
  end: string;
  /** Через скільки хвилин почнеться (0, якщо вже діє) */
  starts_in_minutes: number;
  /** Через скільки хвилин закінчиться; null, якщо відключення триває цілодобово */
  ends_in_minutes: number | null;
  duration_minutes: number;
}

export function parseTime(value: string): number | null {
  const m = TIME_RE.exec(value);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export function formatTime(minutes: number): string {
  const m = ((minutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Маска доби: mask[i] === true, якщо у хвилину i є відключення. Некоректні елементи ігноруються. */
export function buildOutageMask(schedule: unknown): boolean[] {
  const mask: boolean[] = new Array<boolean>(MINUTES_IN_DAY).fill(false);
  if (!Array.isArray(schedule)) return mask;

  const mark = (from: number, length: number) => {
    for (let i = 0; i < length; i++) mask[(from + i) % MINUTES_IN_DAY] = true;
  };

  for (const item of schedule as unknown[]) {
    if (typeof item === 'string') {
      if (!HOUR_SLOT_RE.test(item)) continue;
      const start = parseTime(item);
      if (start !== null) mark(start, 60);
    } else if (item && typeof item === 'object') {
      const { start, end } = item as { start?: unknown; end?: unknown };
      if (typeof start !== 'string' || typeof end !== 'string') continue;
      const s = parseTime(start);
      const e = parseTime(end);
      if (s === null || e === null || s === e) continue;
      mark(s, (e - s + MINUTES_IN_DAY) % MINUTES_IN_DAY);
    }
  }
  return mask;
}

/** Для алгоритмів: hourly[h] === true, якщо хоча б частина години h потрапляє у відключення. */
export function hourlyOutageMask(schedule: unknown): boolean[] {
  const mask = buildOutageMask(schedule);
  return Array.from({ length: 24 }, (_, h) => mask.slice(h * 60, h * 60 + 60).some(Boolean));
}

/** Поточна хвилина доби в заданому часовому поясі. */
export function minutesOfDayInTimeZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

/** Найближче (або поточне) відключення відносно хвилини доби `nowMinutes`. */
export function getOutageStatus(schedule: unknown, nowMinutes: number): OutageStatus | null {
  const mask = buildOutageMask(schedule);
  const total = mask.filter(Boolean).length;
  if (total === 0) return null;

  const now = ((Math.floor(nowMinutes) % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const at = (i: number) => mask[((i % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY] === true;

  // Відключення триває цілодобово
  if (total === MINUTES_IN_DAY) {
    return {
      is_active: true,
      start: '00:00',
      end: '00:00',
      starts_in_minutes: 0,
      ends_in_minutes: null,
      duration_minutes: MINUTES_IN_DAY,
    };
  }

  if (at(now)) {
    let back = 0;
    while (at(now - back - 1)) back++;
    let forward = 1;
    while (at(now + forward)) forward++;
    return {
      is_active: true,
      start: formatTime(now - back),
      end: formatTime(now + forward),
      starts_in_minutes: 0,
      ends_in_minutes: forward,
      duration_minutes: back + forward,
    };
  }

  let wait = 1;
  while (!at(now + wait)) wait++;
  const startMinute = now + wait;
  let length = 1;
  while (at(startMinute + length)) length++;
  return {
    is_active: false,
    start: formatTime(startMinute),
    end: formatTime(startMinute + length),
    starts_in_minutes: wait,
    ends_in_minutes: wait + length,
    duration_minutes: length,
  };
}
