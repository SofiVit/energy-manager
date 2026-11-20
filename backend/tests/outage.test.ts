import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildOutageMask, formatTime, getOutageStatus, hourlyOutageMask, minutesOfDayInTimeZone, parseTime,
} from '../src/utils/outage';

const t = (s: string) => parseTime(s)!;

test('parseTime / formatTime', () => {
  assert.equal(parseTime('00:00'), 0);
  assert.equal(parseTime('23:59'), 1439);
  assert.equal(parseTime('24:00'), null);
  assert.equal(parseTime('7:00'), null);
  assert.equal(formatTime(1500), '01:00');
  assert.equal(formatTime(-60), '23:00');
});

test('маска: годинні слоти та інтервали, некоректні елементи ігноруються', () => {
  const mask = buildOutageMask(['12:00', { start: '20:00', end: '21:30' }, 'abc', 5, null, { start: '10:00', end: '10:00' }]);
  assert.equal(mask.filter(Boolean).length, 60 + 90);
  assert.ok(mask[t('12:00')] && mask[t('12:59')] && !mask[t('13:00')]);
  assert.ok(mask[t('21:29')] && !mask[t('21:30')]);
  assert.equal(buildOutageMask('not an array').some(Boolean), false);
});

test('інтервал через північ', () => {
  const mask = buildOutageMask([{ start: '22:00', end: '02:00' }]);
  assert.equal(mask.filter(Boolean).length, 240);
  assert.ok(mask[t('23:30')] && mask[t('01:59')] && !mask[t('02:00')]);
});

test('hourlyOutageMask для алгоритмів', () => {
  const h = hourlyOutageMask(['00:00', { start: '12:30', end: '13:30' }]);
  assert.equal(h.length, 24);
  assert.deepEqual(h.map((v, i) => (v ? i : -1)).filter((i) => i >= 0), [0, 12, 13]);
});

test('порожній графік → null', () => {
  assert.equal(getOutageStatus([], t('10:00')), null);
});

test('найближче відключення сьогодні', () => {
  const s = getOutageStatus(['20:00', '21:00'], t('18:00'))!;
  assert.deepEqual(s, {
    is_active: false, start: '20:00', end: '22:00', starts_in_minutes: 120, ends_in_minutes: 240, duration_minutes: 120,
  });
});

test('найближче відключення — завтра (після кінця сьогоднішніх)', () => {
  const s = getOutageStatus(['08:00'], t('23:30'))!;
  assert.equal(s.is_active, false);
  assert.equal(s.start, '08:00');
  assert.equal(s.starts_in_minutes, 8 * 60 + 30);
});

test('відключення діє зараз: початок раніше, кінець пізніше', () => {
  const s = getOutageStatus(['12:00', '13:00'], t('12:40'))!;
  assert.deepEqual(s, {
    is_active: true, start: '12:00', end: '14:00', starts_in_minutes: 0, ends_in_minutes: 80, duration_minutes: 120,
  });
});

test('злиття слотів через північ: 23:00 + 00:00 = 23:00–01:00', () => {
  const s = getOutageStatus(['23:00', '00:00'], t('23:10'))!;
  assert.equal(s.start, '23:00');
  assert.equal(s.end, '01:00');
  assert.equal(s.duration_minutes, 120);
  const after = getOutageStatus(['23:00', '00:00'], t('00:30'))!;
  assert.equal(after.is_active, true);
  assert.equal(after.start, '23:00');
  assert.equal(after.ends_in_minutes, 30);
});

test('цілодобове відключення', () => {
  const all = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);
  const s = getOutageStatus(all, t('05:00'))!;
  assert.equal(s.is_active, true);
  assert.equal(s.ends_in_minutes, null);
  assert.equal(s.duration_minutes, 1440);
});

test('точна межа: рівно в момент початку — вже активне; за хвилину до — starts_in = 1', () => {
  assert.equal(getOutageStatus(['20:00'], t('20:00'))!.is_active, true);
  assert.equal(getOutageStatus(['20:00'], t('19:59'))!.starts_in_minutes, 1);
  assert.equal(getOutageStatus(['20:00'], t('21:00'))!.is_active, false);
});

test('часовий пояс: Europe/Kyiv відрізняється від UTC на 2–3 години', () => {
  const winter = new Date('2026-01-15T10:00:00Z'); // Київ UTC+2
  const summer = new Date('2026-07-15T10:00:00Z'); // Київ UTC+3
  assert.equal(minutesOfDayInTimeZone(winter, 'Europe/Kyiv'), 12 * 60);
  assert.equal(minutesOfDayInTimeZone(summer, 'Europe/Kyiv'), 13 * 60);
  assert.equal(minutesOfDayInTimeZone(new Date('2026-01-15T22:30:00Z'), 'Europe/Kyiv'), 30); // 00:30 наступної доби
});
