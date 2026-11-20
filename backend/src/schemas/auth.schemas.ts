import { z } from 'zod';
import { numeric } from './common';
import { HOUR_SLOT_RE, TIME_RE } from '../utils/outage';

const email = z
  .string({ error: 'Email є обов’язковим' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Некоректний email' }).max(255, 'Email занадто довгий'));

// bcrypt ігнорує все після 72 байтів, тому довші паролі відхиляємо явно
const newPassword = z
  .string({ error: 'Пароль є обов’язковим' })
  .min(8, 'Пароль має містити щонайменше 8 символів')
  .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Пароль занадто довгий (максимум 72 байти)');

const name = z
  .string({ error: 'Ім’я є обов’язковим' })
  .trim()
  .min(1, 'Ім’я є обов’язковим')
  .max(100, 'Ім’я занадто довге');

const maxPowerLimitKw = numeric(
  z.number({ error: 'Ліміт потужності має бути числом' })
    .positive('Ліміт потужності має бути більше 0')
    .max(99.99, 'Ліміт потужності не може перевищувати 99.99 кВт'),
);

const tariffType = z.enum(['single', 'dual', 'triple'], {
  error: 'Тип тарифу має бути single, dual або triple',
});

const baseTariffRate = numeric(
  z.number({ error: 'Тариф має бути числом' })
    .positive('Тариф має бути більше 0')
    .max(9999.99, 'Тариф занадто великий'),
);

const outageItem = z.union([
  z.string().regex(HOUR_SLOT_RE, 'Година відключення має бути у форматі "HH:00"'),
  z
    .object({
      start: z.string().regex(TIME_RE, 'Початок має бути у форматі "HH:MM"'),
      end: z.string().regex(TIME_RE, 'Кінець має бути у форматі "HH:MM"'),
    })
    .refine((i) => i.start !== i.end, 'Початок і кінець відключення не можуть збігатися'),
]);

export const outageScheduleSchema = z
  .array(outageItem, { error: 'Графік відключень має бути масивом' })
  .max(96, 'Забагато елементів у графіку відключень');

export const registerSchema = z.object({
  name,
  email,
  password: newPassword,
  max_power_limit_kw: maxPowerLimitKw.optional(),
  tariff_type: tariffType.optional(),
});

export const loginSchema = z.object({
  email: z.string({ error: 'Email та пароль є обов’язковими' }).trim().toLowerCase().min(1, 'Email та пароль є обов’язковими'),
  // Мінімальну довжину при вході не перевіряємо: у старих акаунтів пароль може бути коротшим
  password: z.string({ error: 'Email та пароль є обов’язковими' }).min(1, 'Email та пароль є обов’язковими'),
});

export const settingsSchema = z
  .object({
    name: name.optional(),
    email: email.optional(),
    max_power_limit_kw: maxPowerLimitKw.optional(),
    tariff_type: tariffType.optional(),
    base_tariff_rate: baseTariffRate.optional(),
    language: z.enum(['uk', 'en'], { error: 'Мова має бути uk або en' }).optional(),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, 'Валюта має бути трибуквеним кодом ISO (наприклад, UAH)')
      .optional(),
    outage_group: z
      .string()
      .trim()
      .max(10, 'Черга відключень занадто довга')
      .nullable()
      .transform((v) => (v === '' ? null : v))
      .optional(),
    outage_schedule: outageScheduleSchema.optional(),
  })
  .refine((o) => Object.values(o).some((v) => v !== undefined), {
    message: 'Не передано жодного поля для оновлення',
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string({ error: 'Введіть поточний та новий паролі' }).min(1, 'Введіть поточний та новий паролі'),
    newPassword,
  })
  .refine((o) => o.currentPassword !== o.newPassword, {
    message: 'Новий пароль має відрізнятися від поточного',
    path: ['newPassword'],
  });

export const forgotPasswordSchema = z.object({
  email,
});

export const resetPasswordSchema = z.object({
  token: z.string({ error: 'Токен відновлення є обов’язковим' }).trim().min(1, 'Токен відновлення є обов’язковим'),
  newPassword,
}); 