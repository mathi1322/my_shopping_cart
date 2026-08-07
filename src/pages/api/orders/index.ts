import type { APIRoute } from 'astro';
import { container } from '../../../infrastructure/di/container';
import { placeOrderSchema } from '../../../lib/validation/orderSchemas';
import { jsonResponse } from '../../../lib/http/jsonResponse';
import { toErrorResponse } from '../../../lib/http/errorResponse';
import { requireUser } from '../../../lib/http/requireUser';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  try {
    const requestingUser = requireUser(locals.user);
    const orders = await container.listOrdersForBuyer.execute(requestingUser.id);
    return jsonResponse({ orders });
  } catch (error) {
    return toErrorResponse(error);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const requestingUser = requireUser(locals.user);
    const body = await request.json();
    const input = placeOrderSchema.parse(body);

    const order = await container.placeOrder.execute({
      buyerId: requestingUser.id,
      buyerEmail: locals.user!.email,
      deliveryAddress: input.deliveryAddress,
      deliveryPhone: input.deliveryPhone,
    });

    return jsonResponse(order, 201);
  } catch (error) {
    return toErrorResponse(error);
  }
};
