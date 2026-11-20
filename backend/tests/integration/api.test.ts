import '../setup';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { createApp } from '../../src/app';
import { pool } from '../../src/db';
import { getDashboardSummary, getNotificationsData } from '../../src/services/dashboard.service';

// Інтеграційні тести працюють із реальною PostgreSQL (схема з init_full_db.sql) і потребують DATABASE_URL
const skip = process.env.DATABASE_URL ? false : 'DATABASE_URL не задано';

const RUN = Date.now();
const email = (n: string) => `it-${n}-${RUN}@test.local`;
const PASSWORD = 'password123';

let server: Server;
let base = '';
const createdEmails: string[] = [];

async function call(method: string, path: string, body?: unknown, token?: string) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function register(n: string) {
  createdEmails.push(email(n));
  const r = await call('POST', '/api/auth/register', { name: `User ${n}`, email: email(n), password: PASSWORD });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { token: r.body.token as string, id: r.body.user.id as string };
}

describe('API (інтеграційні)', { skip }, () => {
  before(async () => {
    server = createApp().listen(0);
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    if (createdEmails.length) await pool.query('DELETE FROM users WHERE email = ANY($1)', [createdEmails]);
    await new Promise((r) => server.close(r));
    await pool.end();
  });

  test('health та 404', async () => {
    assert.deepEqual((await call('GET', '/api/health')).body, { status: 'ok' });
    assert.equal((await call('GET', '/api/nope')).status, 404);
  });

  describe('auth', () => {
    test('реєстрація, дубль, вхід, /me без хеша пароля', async () => {
      const { token } = await register('a');
      const dup = await call('POST', '/api/auth/register', { name: 'X', email: email('a').toUpperCase(), password: PASSWORD });
      assert.equal(dup.status, 409);
      assert.match(dup.body.message, /вже існує/);

      const bad = await call('POST', '/api/auth/login', { email: email('a'), password: 'wrong-password' });
      assert.equal(bad.status, 401);
      const unknown = await call('POST', '/api/auth/login', { email: 'nobody@test.local', password: PASSWORD });
      assert.equal(unknown.status, 401);
      assert.equal(unknown.body.message, bad.body.message);

      const login = await call('POST', '/api/auth/login', { email: email('a'), password: PASSWORD });
      assert.equal(login.status, 200);
      assert.equal('password_hash' in login.body.user, false);

      const me = await call('GET', '/api/auth/me', undefined, token);
      assert.equal(me.status, 200);
      assert.equal('password_hash' in me.body, false);
      assert.equal(me.body.tariff_type, 'single');
      assert.equal(me.body.language, 'uk');
      assert.deepEqual(me.body.outage_schedule, []);
    });

    test('валідація реєстрації повертає 400 з message та errors', async () => {
      const r = await call('POST', '/api/auth/register', { name: 'X', email: 'bad', password: '123' });
      assert.equal(r.status, 400);
      assert.ok(r.body.message);
      assert.ok(r.body.errors.length >= 2);
      assert.equal((await call('POST', '/api/auth/register', '{broken')).status, 400);
    });

    test('захищені маршрути вимагають дійсний токен', async () => {
      assert.equal((await call('GET', '/api/auth/me')).status, 401);
      assert.equal((await call('GET', '/api/auth/me', undefined, 'garbage')).status, 401);
      assert.equal((await call('GET', '/api/devices/my')).status, 401);
      assert.equal((await call('GET', '/api/dashboard/summary')).status, 401);
    });

    test('settings: часткове оновлення, графік відключень, конфлікт email, помилки', async () => {
      const { token } = await register('s');
      await register('s2');

      const ok = await call('PATCH', '/api/auth/settings', {
        max_power_limit_kw: '3.7', tariff_type: 'dual', base_tariff_rate: 4, language: 'en', currency: 'uah',
        outage_group: '2.1', outage_schedule: ['00:00', '12:00', { start: '20:00', end: '21:30' }],
      }, token);
      assert.equal(ok.status, 200, JSON.stringify(ok.body));
      assert.equal(Number(ok.body.user.max_power_limit_kw), 3.7);
      assert.equal(ok.body.user.tariff_type, 'dual');
      assert.equal(ok.body.user.currency, 'UAH');
      assert.deepEqual(ok.body.user.outage_schedule, ['00:00', '12:00', { start: '20:00', end: '21:30' }]);
      assert.equal(ok.body.user.name, 'User s'); // непередані поля не змінились

      assert.equal((await call('PATCH', '/api/auth/settings', { email: email('s2') }, token)).status, 409);
      assert.equal((await call('PATCH', '/api/auth/settings', {}, token)).status, 400);
      assert.equal((await call('PATCH', '/api/auth/settings', { tariff_type: 'quad' }, token)).status, 400);
      assert.equal((await call('PATCH', '/api/auth/settings', { outage_schedule: ['99:00'] }, token)).status, 400);

      const cleared = await call('PATCH', '/api/auth/settings', { outage_group: null }, token);
      assert.equal(cleared.body.user.outage_group, null);
    });

    test('зміна пароля', async () => {
      const { token } = await register('p');
      assert.equal((await call('PATCH', '/api/auth/password', { currentPassword: 'wrong', newPassword: 'newpass1234' }, token)).status, 400);
      assert.equal((await call('PATCH', '/api/auth/password', { currentPassword: PASSWORD, newPassword: PASSWORD }, token)).status, 400);
      assert.equal((await call('PATCH', '/api/auth/password', { currentPassword: PASSWORD, newPassword: 'newpass1234' }, token)).status, 200);
      assert.equal((await call('POST', '/api/auth/login', { email: email('p'), password: PASSWORD })).status, 401);
      assert.equal((await call('POST', '/api/auth/login', { email: email('p'), password: 'newpass1234' })).status, 200);
    });
  });

  describe('devices', () => {
    test('довідники публічні, підтримують lang', async () => {
      const cats = await call('GET', '/api/devices/categories');
      assert.equal(cats.status, 200);
      assert.ok(cats.body.length >= 6);
      const en = await call('GET', '/api/devices/categories?lang=en');
      assert.notDeepEqual(en.body.map((c: { name: string }) => c.name), cats.body.map((c: { name: string }) => c.name));

      const presets = await call('GET', '/api/devices/presets');
      assert.ok(presets.body.length >= 60);
      assert.ok(['low', 'medium', 'high'].includes(presets.body[0].priority));
      assert.equal((await call('GET', '/api/devices/presets?lang=xx')).status, 200); // некоректна мова → uk
    });

    test('CRUD, ізоляція користувачів, валідація', async () => {
      const a = await register('da');
      const b = await register('db');

      const created = await call('POST', '/api/devices/my', {
        title: 'Пральна машина', power_watts: 2000, priority: 'high', operating_mode: 'scheduled', duration_hours: 1.5, category_id: 1,
      }, a.token);
      assert.equal(created.status, 201, JSON.stringify(created.body));
      assert.equal(created.body.priority, 'high');
      assert.equal(created.body.avg_duration_minutes, 90);
      assert.equal(created.body.duration_hours, 1.5);
      assert.ok(created.body.category_name);
      assert.equal(created.body.allow_backup_power, false);
      assert.equal(created.body.is_active, true);
      const id = created.body.id as string;

      assert.equal((await call('POST', '/api/devices/my', { title: 'x' }, a.token)).status, 400);
      assert.equal((await call('POST', '/api/devices/my', { title: 'x', power_watts: 10, operating_mode: 'auto' }, a.token)).status, 400);
      assert.equal((await call('POST', '/api/devices/my', { title: 'x', power_watts: 10, category_id: 99999 }, a.token)).status, 400);

      const list = await call('GET', '/api/devices/my', undefined, a.token);
      assert.equal(list.body.length, 1);
      assert.equal((await call('GET', '/api/devices/my', undefined, b.token)).body.length, 0);

      const patched = await call('PATCH', `/api/devices/my/${id}`, { is_active: false, priority: 'low', allow_backup_power: true, category_id: null }, a.token);
      assert.equal(patched.status, 200, JSON.stringify(patched.body));
      assert.equal(patched.body.is_active, false);
      assert.equal(patched.body.priority, 'low');
      assert.equal(patched.body.allow_backup_power, true);
      assert.equal(patched.body.category_id, null);
      assert.equal(patched.body.title, 'Пральна машина');

      assert.equal((await call('PATCH', `/api/devices/my/${id}`, { title: 'hack' }, b.token)).status, 404);
      assert.equal((await call('DELETE', `/api/devices/my/${id}`, undefined, b.token)).status, 404);
      assert.equal((await call('PATCH', '/api/devices/my/not-a-uuid', { title: 'x' }, a.token)).status, 400);
      assert.equal((await call('PATCH', `/api/devices/my/${id}`, {}, a.token)).status, 400);

      assert.equal((await call('DELETE', `/api/devices/my/${id}`, undefined, a.token)).status, 200);
      assert.equal((await call('DELETE', `/api/devices/my/${id}`, undefined, a.token)).status, 404);
    });
  });

  describe('dashboard', () => {
    test('summary: порожній користувач', async () => {
      const { token } = await register('d0');
      const r = await call('GET', '/api/dashboard/summary', undefined, token);
      assert.equal(r.status, 200);
      assert.equal(r.body.active_devices, 0);
      assert.equal(r.body.total_power_kw, 0);
      assert.equal(r.body.battery_reserve_kwh, 0);
      assert.equal(r.body.savings, null);
      assert.equal(r.body.last_schedule, null);
      assert.equal(r.body.next_outage, null);
    });

    test('summary і notifications за заданим часом', async () => {
      const { token, id } = await register('d1');
      await call('PATCH', '/api/auth/settings', { outage_schedule: ['20:00', '21:00'] }, token);

      const dev = (title: string, w: number, backup: boolean) =>
        call('POST', '/api/devices/my', { title, power_watts: w, allow_backup_power: backup }, token);
      await dev('Насос', 1000, false);
      await dev('Холодильник', 150, true);
      const off = (await dev('Старий обігрівач', 500, false)).body.id;
      await call('PATCH', `/api/devices/my/${off}`, { is_active: false }, token);

      await pool.query(
        `INSERT INTO power_sources (user_id, title, type, capacity_wh, max_output_watts) VALUES
         ($1,'АКБ','inverter_battery',5000,3000), ($1,'Станція','station',2000,1500), ($1,'Генератор','generator',0,2500)`, [id]);
      await pool.query(
        `INSERT INTO schedules (user_id, schedule_date, strategy, total_energy_kwh, total_cost_uah, schedule_data)
         VALUES ($1, CURRENT_DATE, 'cost_min', 12.3, 80.5, $2::jsonb)`,
        [id, JSON.stringify({ baseline: { total_cost_uah: 111.1, total_energy_kwh: 14.1 } })]);

      const at = new Date('2026-01-15T16:00:00Z'); // 18:00 за Києвом
      const s = await getDashboardSummary(id, at);
      assert.equal(s.active_devices, 2);
      assert.equal(s.total_power_watts, 1150);
      assert.equal(s.total_power_kw, 1.15);
      assert.equal(s.battery_reserve_wh, 7000);
      assert.equal(s.battery_reserve_kwh, 7);
      assert.deepEqual(s.savings, { cost_uah: 30.6, energy_kwh: 1.8 });
      assert.equal(s.last_schedule?.strategy, 'cost_min');
      assert.match(String(s.last_schedule?.schedule_date), /^\d{4}-\d{2}-\d{2}$/);
      assert.equal(s.next_outage?.start, '20:00');
      assert.equal(s.next_outage?.end, '22:00');
      assert.equal(s.next_outage?.starts_in_minutes, 120);

      const n = await getNotificationsData(id, at);
      assert.equal(n.should_warn, false);
      assert.deepEqual(n.critical_devices.map((d) => d.title), ['Насос']);

      const soon = await getNotificationsData(id, new Date('2026-01-15T17:50:00Z')); // 19:50, за 10 хв
      assert.equal(soon.should_warn, true);
      assert.equal(soon.next_outage?.starts_in_minutes, 10);

      const during = await getNotificationsData(id, new Date('2026-01-15T18:30:00Z')); // 20:30
      assert.equal(during.next_outage?.is_active, true);
      assert.equal(during.should_warn, false);

      // HTTP-шар повертає ту саму структуру
      const http = await call('GET', '/api/dashboard/notifications', undefined, token);
      assert.equal(http.status, 200);
      assert.equal(http.body.warn_before_minutes, 15);
      assert.equal(http.body.critical_devices.length, 1);
    });

    test('savings = null, якщо в розкладі немає baseline', async () => {
      const { id } = await register('d2');
      await pool.query(
        `INSERT INTO schedules (user_id, schedule_date, strategy, total_energy_kwh, total_cost_uah, schedule_data)
         VALUES ($1, CURRENT_DATE, 'balanced', 5, 40, '{}'::jsonb)`, [id]);
      const s = await getDashboardSummary(id);
      assert.equal(s.savings, null);
      assert.equal(s.last_schedule?.strategy, 'balanced');
    });
  });
});
