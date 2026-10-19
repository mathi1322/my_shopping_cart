import type { APIRoute } from 'astro';
import { container } from '../../../../infrastructure/di/container';
import { updateCartItemSchema } from '../../../../lib/validation/cartSchemas';
import { presentCart } from '../../../../application/cart/CartDto';
import { jsonResponse } from '../../../../lib/http/jsonResponse';
import { toErrorResponse } from '../../../../lib/http/errorResponse';
import { requireUser } from '../../../../lib/http/requireUser';

export const prerender = false;

export const PUT: APIRoute = async ({ params, request, locals }) => {
  try {
    const requestingUser = requireUser(locals.user);
    const body = await request.json();
    const input = updateCartItemSchema.parse(body);

    const cart = await container.updateCartItemQuantity.execute({
      userId: requestingUser.id,
      productId: params.productId!,
      quantity: input.quantity,
    });

    return jsonResponse(await presentCart(cart, container.vendorDirectory));
  } catch (error) {
    return toErrorResponse(error);
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    const requestingUser = requireUser(locals.user);
    const cart = await container.removeCartItem.execute({
      userId: requestingUser.id,
      productId: params.productId!,
    });
    return jsonResponse(await presentCart(cart, container.vendorDirectory));
  } catch (error) {
    return toErrorResponse(error);
  }
};
