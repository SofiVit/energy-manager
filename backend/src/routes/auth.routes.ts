import crypto from 'node:crypto';
import { Router } from 'express';
import type { Response } from 'express';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import type { SignOptions } from 'jsonwebtoken';
import { pool } from '../db';
import { env } from '../config/env';
import { authenticateToken } from '../middleware/auth.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  settingsSchema,
} from '../schemas/auth.schemas';
import { AppError, badRequest, notFound, unauthorized } from '../utils/errors';
import { buildUpdate } from '../utils/sql';

const router = Router();

const BCRYPT_ROUNDS = 10;
const RESET_TOKEN_TTL_MINUTES = 15;
// Порівняння з "порожнім" хешем вирівнює час відповіді, коли email не існує (захист від перебору email)
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS);

// Захист від брутфорсу (підбору паролів): не більше 15 спроб за 15 хвилин з однієї IP-адреси
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: { message: 'Забагато спроб. Будь ласка, спробуйте пізніше через 15 хвилин.' },
});

/** Публічні поля користувача — password_hash сюди не потрапляє ніколи. */
const USER_COLUMNS = `id, name, email, max_power_limit_kw, tariff_type, base_tariff_rate,
  language, currency, outage_group, outage_schedule`;

const SETTINGS_COLUMNS = [
  'name',
  'email',
  'max_power_limit_kw',
  'tariff_type',
  'base_tariff_rate',
  'language',
  'currency',
  'outage_group',
  'outage_schedule',
] as const;

const signToken = (userId: string): string =>
  jwt.sign({ userId }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] });

const hashResetToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res: Response) => {
  const data = registerSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  // Унікальність email гарантує обмеження БД (23505 → 409 в errorHandler): без гонки між SELECT та INSERT
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, max_power_limit_kw, tariff_type)
     VALUES ($1, $2, $3, COALESCE($4, 3.50), COALESCE($5, 'single'))
     RETURNING ${USER_COLUMNS}`,
    [data.name, data.email, passwordHash, data.max_power_limit_kw ?? null, data.tariff_type ?? null],
  );

  const user = result.rows[0];
  res.status(201).json({ message: 'Реєстрація успішна', user, token: signToken(user.id) });
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res: Response) => {
  const { email, password } = loginSchema.parse(req.body);

  const result = await pool.query(`SELECT ${USER_COLUMNS}, password_hash FROM users WHERE email = $1`, [email]);
  const row = result.rows[0];

  const isValid = await bcrypt.compare(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !isValid) throw unauthorized('Невірний email або пароль');

  const { password_hash: _omit, ...user } = row;
  res.json({ message: 'Вхід успішний', user, token: signToken(user.id) });
});

// POST /api/auth/forgot-password — запит на відновлення забутого пароля
router.post('/forgot-password', authLimiter, async (req, res: Response) => {
  const { email } = forgotPasswordSchema.parse(req.body);

  const userRes = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  let devResetToken: string | undefined;

  if (userRes.rows.length > 0) {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    await pool.query(
      'UPDATE users SET reset_token_hash = $1, reset_token_expires = $2 WHERE id = $3',
      [tokenHash, expiresAt, userRes.rows[0].id],
    );

    if (env.NODE_ENV !== 'production') {
      devResetToken = rawToken;
      if (env.NODE_ENV !== 'test') {
        console.log(`🔑 [DEV] Токен скидання пароля для ${email}: ${rawToken}`);
      }
    }
  }

  res.json({
    message: 'Якщо акаунт із таким email існує, інструкції для відновлення пароля надіслано',
    ...(devResetToken ? { dev_reset_token: devResetToken } : {}),
  });
});

// POST /api/auth/reset-password — встановлення нового пароля за токеном
router.post('/reset-password', authLimiter, async (req, res: Response) => {
  const { token, newPassword } = resetPasswordSchema.parse(req.body);
  const tokenHash = hashResetToken(token);

  const userRes = await pool.query(
    'SELECT id FROM users WHERE reset_token_hash = $1 AND reset_token_expires > NOW()',
    [tokenHash],
  );

  if (userRes.rows.length === 0) {
    throw badRequest('Недійсний або прострочений токен відновлення пароля');
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await pool.query(
    `UPDATE users
     SET password_hash = $1, reset_token_hash = NULL, reset_token_expires = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2`,
    [newHash, userRes.rows[0].id],
  );

  res.json({ message: 'Пароль успішно відновлено. Тепер ви можете увійти з новим паролем.' });
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  const result = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE id = $1`, [req.user?.id]);
  if (result.rows.length === 0) throw notFound('Користувача не знайдено');
  res.json(result.rows[0]);
});

// PATCH /api/auth/settings — часткове оновлення профілю та параметрів енергосистеми
router.patch('/settings', authenticateToken, async (req: AuthRequest, res: Response) => {
  const data = settingsSchema.parse(req.body);
  const update = buildUpdate(SETTINGS_COLUMNS, data, { jsonColumns: ['outage_schedule'] });
  if (!update) throw badRequest('Не передано жодного поля для оновлення');

  const result = await pool.query(
    `UPDATE users SET ${update.setClause}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $${update.values.length + 1}
     RETURNING ${USER_COLUMNS}`,
    [...update.values, req.user?.id],
  );

  if (result.rows.length === 0) throw notFound('Користувача не знайдено');
  res.json({ message: 'Налаштування збережено', user: result.rows[0] });
});

// PATCH /api/auth/password
router.patch('/password', authenticateToken, async (req: AuthRequest, res: Response) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

  const userRes = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.user?.id]);
  if (userRes.rows.length === 0) throw notFound('Користувача не знайдено');

  const isValid = await bcrypt.compare(currentPassword, userRes.rows[0].password_hash);
  if (!isValid) throw new AppError(400, 'Невірний поточний пароль');

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await pool.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [
    newHash,
    req.user?.id,
  ]);

  res.json({ message: 'Пароль успішно змінено' });
});

export default router;