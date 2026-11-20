import { z } from 'zod';

/** Число, яке допускається і як рядок ("3.7") — слайдери та інпути часто віддають рядки. */
export const numeric = <T extends z.ZodType<number>>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v), schema);

export const langSchema = z.enum(['uk', 'en']).catch('uk');

export const uuidParam = z.object({
  id: z.uuid({ error: 'Некоректний ідентифікатор' }),
});
