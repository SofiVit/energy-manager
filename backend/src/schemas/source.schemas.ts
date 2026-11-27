import { z } from 'zod';

const sourceTypeSchema = z.enum(['station', 'inverter_battery', 'generator']);

export const createSourceSchema = z
  .object({
    title: z.string().trim().min(1, 'Вкажіть назву джерела живлення').max(100),
    type: sourceTypeSchema,
    capacity_wh: z.number().int().min(0, 'Ємність не може бути від’ємною').max(1_000_000).optional(),
    max_output_watts: z.number().int().min(1, 'Потужність має бути більшою за 0').max(100_000),
    charge_time_minutes: z.number().int().min(1).max(10_080).nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type !== 'generator' && (data.capacity_wh === undefined || data.capacity_wh <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['capacity_wh'],
        message: 'Для зарядної станції або інвертора ємність (capacity_wh) має бути більшою за 0',
      });
    }
  });

export const updateSourceSchema = z
  .object({
    title: z.string().trim().min(1, 'Вкажіть назву джерела живлення').max(100).optional(),
    type: sourceTypeSchema.optional(),
    capacity_wh: z.number().int().min(0).max(1_000_000).optional(),
    max_output_watts: z.number().int().min(1).max(100_000).optional(),
    charge_time_minutes: z.number().int().min(1).max(10_080).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Передайте хоча б одне поле для оновлення',
  });