import { test } from 'node:test';
import assert from 'node:assert/strict';
import './setup';
import { registerSchema, loginSchema, settingsSchema, changePasswordSchema } from '../src/schemas/auth.schemas';
import { createDeviceSchema, updateDeviceSchema } from '../src/schemas/device.schemas';

const fails = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  assert.equal(schema.safeParse(v).success, false, JSON.stringify(v));

test('register: нормалізація email, дефолти та відхилення поганих даних', () => {
  const ok = registerSchema.parse({ name: '  Оля ', email: '  Ola@Test.COM ', password: 'password1' });
  assert.equal(ok.email, 'ola@test.com');
  assert.equal(ok.name, 'Оля');
  fails(registerSchema, { name: 'a', email: 'bad', password: 'password1' });
  fails(registerSchema, { name: 'a', email: 'a@b.com', password: 'short' });
  fails(registerSchema, { name: 'a', email: 'a@b.com', password: 'я'.repeat(40) }); // >72 байтів
  fails(registerSchema, { name: '', email: 'a@b.com', password: 'password1' });
  fails(registerSchema, { name: 'a', email: 'a@b.com', password: 'password1', tariff_type: 'quad' });
  fails(registerSchema, { name: 'a', email: 'a@b.com', password: 'password1', max_power_limit_kw: 100 });
});

test('login не вимагає мінімальної довжини пароля', () => {
  assert.equal(loginSchema.safeParse({ email: 'a@b.com', password: '1' }).success, true);
  fails(loginSchema, { email: '', password: 'x' });
});

test('settings: числа-рядки, валюта, порожнє тіло, графік відключень', () => {
  const s = settingsSchema.parse({ max_power_limit_kw: '3.7', currency: 'uah', outage_group: '', outage_schedule: ['00:00', { start: '12:00', end: '14:30' }] });
  assert.equal(s.max_power_limit_kw, 3.7);
  assert.equal(s.currency, 'UAH');
  assert.equal(s.outage_group, null);
  fails(settingsSchema, {});
  fails(settingsSchema, { language: 'de' });
  fails(settingsSchema, { base_tariff_rate: -1 });
  fails(settingsSchema, { outage_schedule: ['25:00'] });
  fails(settingsSchema, { outage_schedule: ['12:30'] });
  fails(settingsSchema, { outage_schedule: [{ start: '10:00', end: '10:00' }] });
  fails(settingsSchema, { outage_schedule: 'all day' });
});

test('change password: новий має відрізнятися від поточного', () => {
  fails(changePasswordSchema, { currentPassword: 'password1', newPassword: 'password1' });
  assert.equal(changePasswordSchema.safeParse({ currentPassword: 'old', newPassword: 'password2' }).success, true);
});

test('device create: дефолти, duration_hours → хвилини, строгі типи', () => {
  const d = createDeviceSchema.parse({ title: ' Чайник ', power_watts: '2000', duration_hours: 0.5 });
  assert.deepEqual(d, {
    preset_id: null, category_id: null, title: 'Чайник', power_watts: 2000, priority: 'medium',
    operating_mode: 'flexible', avg_duration_minutes: 30, allow_backup_power: false,
  });
  assert.equal(createDeviceSchema.parse({ title: 'x', power_watts: 5, avg_duration_minutes: 45, duration_hours: 9 }).avg_duration_minutes, 45);
  assert.equal(createDeviceSchema.parse({ title: 'x', power_watts: 5, priority: ' HIGH ' }).priority, 'high');
  fails(createDeviceSchema, { title: 'x' });
  fails(createDeviceSchema, { title: 'x', power_watts: 0 });
  fails(createDeviceSchema, { title: 'x', power_watts: 10.5 });
  fails(createDeviceSchema, { title: 'x', power_watts: 5, operating_mode: 'auto' });
  fails(createDeviceSchema, { title: 'x', power_watts: 5, priority: 'urgent' });
  fails(createDeviceSchema, { title: 'x', power_watts: 5, allow_backup_power: 'false' }); // раніше "false" ставало true
  fails(createDeviceSchema, { title: 'x', power_watts: 5, avg_duration_minutes: 2000 });
});

test('device update: часткове, порожнє — помилка, null категорія дозволена', () => {
  assert.equal(updateDeviceSchema.parse({ is_active: false }).is_active, false);
  assert.equal(updateDeviceSchema.parse({ category_id: null }).category_id, null);
  fails(updateDeviceSchema, {});
});
