import { z } from 'zod';
export const ratioImportSchema = z.object({
  source: z.url().refine((value) => /^https?:\/\//.test(value)),
  retrievedAt: z.iso.datetime(),
  ratios: z
    .array(
      z.object({
        instrumentId: z.string().startsWith('BYMA:'),
        underlyingId: z.string().min(1),
        certificatesPerShare: z
          .string()
          .regex(/^\d{1,12}(\.\d{1,12})?$/)
          .refine((v) => Number(v) > 0),
        effectiveFrom: z.iso.date(),
      }),
    )
    .min(1)
    .max(10000),
});
