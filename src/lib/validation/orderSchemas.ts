import { z } from 'zod';

export const placeOrderSchema = z.object({
  deliveryAddress: z.string().trim().min(1, 'Delivery address is required').max(500),
  deliveryPhone: z.string().trim().min(1, 'Delivery phone number is required').max(20),
});
