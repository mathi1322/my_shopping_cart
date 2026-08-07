import { z } from 'zod';
import { PRODUCT_CATEGORIES } from '../../domain/product/ProductCategory';

const imagesSchema = z.array(z.string().trim().url()).max(8, 'A product can have at most 8 images');
const categorySchema = z.enum(PRODUCT_CATEGORIES);

export const createProductSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(200),
  description: z.string().max(2000).default(''),
  priceInCents: z.number().int().nonnegative(),
  stockQuantity: z.number().int().nonnegative(),
  category: categorySchema,
  images: imagesSchema.optional(),
});

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    priceInCents: z.number().int().nonnegative().optional(),
    stockQuantity: z.number().int().nonnegative().optional(),
    category: categorySchema.optional(),
    images: imagesSchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });
