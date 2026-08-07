import type { APIRoute } from 'astro';
import { container } from '../../../../infrastructure/di/container';
import { addCartItemSchema } from '../../../../lib/validation/cartSchemas';
import { toCartDto } from '../../../../application/cart/CartDto';
import { jsonResponse } from '../../../../lib/http/jsonResponse';
import { toErrorResponse } from '../../../../lib/http/errorResponse';
import { requireUser } from '../../../../lib/http/requireUser';

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const requestingUser = requireUser(locals.user);
    const body = await request.json();
    const input = addCartItemSchema.parse(body);

    const cart = await container.addItemToCart.execute({
      userId: requestingUser.id,
      productId: input.productId,
      quantity: input.quantity,
    });

    return jsonResponse(toCartDto(cart), 201);
  } catch (error) {
    return toErrorResponse(error);
  }
};
