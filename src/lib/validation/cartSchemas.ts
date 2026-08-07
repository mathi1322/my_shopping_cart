import { z } from 'zod';

export const addCartItemSchema = z.object({
  productId: z.string().trim().min(1, 'productId is required'),
  quantity: z.number().int().positive(),
});

export const updateCartItemSchema = z.object({
  quantity: z.number().int().positive(),
});
