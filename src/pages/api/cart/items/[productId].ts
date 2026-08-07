import type { APIRoute } from 'astro';
import type { AstroCookies } from 'astro';
import { container } from '../../../../infrastructure/di/container';
import { updateCartItemSchema } from '../../../../lib/validation/cartSchemas';
import { toCartDto } from '../../../../application/cart/CartDto';
import { jsonResponse } from '../../../../lib/http/jsonResponse';
import { toErrorResponse } from '../../../../lib/http/errorResponse';
import { CART_COOKIE_NAME } from '../../../../lib/http/cartCookie';
import { ValidationError } from '../../../../domain/shared/DomainError';

export const prerender = false;

function requireCartId(cookies: AstroCookies): string {
  const cartId = cookies.get(CART_COOKIE_NAME)?.value;
  if (!cartId) {
    throw new ValidationError('No cart found for this session — add an item first');
  }
  return cartId;
}

export const PUT: APIRoute = async ({ params, request, cookies }) => {
  try {
    const body = await request.json();
    const input = updateCartItemSchema.parse(body);
    const cartId = requireCartId(cookies);

    const cart = await container.updateCartItemQuantity.execute({
      cartId,
      productId: params.productId!,
      quantity: input.quantity,
    });

    return jsonResponse(toCartDto(cart));
  } catch (error) {
    return toErrorResponse(error);
  }
};

export const DELETE: APIRoute = async ({ params, cookies }) => {
  try {
    const cartId = requireCartId(cookies);
    const cart = await container.removeCartItem.execute({
      cartId,
      productId: params.productId!,
    });
    return jsonResponse(toCartDto(cart));
  } catch (error) {
    return toErrorResponse(error);
  }
};
