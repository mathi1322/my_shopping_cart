import { z } from 'zod';

export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(200),
  description: z.string().max(2000).default(''),
  priceInCents: z.number().int().nonnegative(),
  stockQuantity: z.number().int().nonnegative(),
});

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    priceInCents: z.number().int().nonnegative().optional(),
    stockQuantity: z.number().int().nonnegative().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });
