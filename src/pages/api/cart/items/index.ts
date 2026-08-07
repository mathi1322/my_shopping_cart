import type { APIRoute } from 'astro';
import { container } from '../../../../infrastructure/di/container';
import { addCartItemSchema } from '../../../../lib/validation/cartSchemas';
import { toCartDto } from '../../../../application/cart/CartDto';
import { jsonResponse } from '../../../../lib/http/jsonResponse';
import { toErrorResponse } from '../../../../lib/http/errorResponse';
import { CART_COOKIE_NAME, setCartCookie } from '../../../../lib/http/cartCookie';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const input = addCartItemSchema.parse(body);
    const existingCartId = cookies.get(CART_COOKIE_NAME)?.value;

    const cart = await container.addItemToCart.execute({
      cartId: existingCartId,
      productId: input.productId,
      quantity: input.quantity,
    });

    setCartCookie(cookies, cart.id.toString());
    return jsonResponse(toCartDto(cart), 201);
  } catch (error) {
    return toErrorResponse(error);
  }
};
