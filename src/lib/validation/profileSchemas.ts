import { z } from 'zod';

export const updateProfileSchema = z
  .object({
    name: z.string().trim().max(200).optional(),
    phone: z.string().trim().max(20).optional(),
    address: z.string().trim().max(500).optional(),
    companyName: z.string().trim().max(200).optional(),
    companyAddress: z.string().trim().max(500).optional(),
    gstNumber: z.string().trim().max(15).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });
