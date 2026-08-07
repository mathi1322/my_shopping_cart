import type { APIRoute } from 'astro';
import { container } from '../../../infrastructure/di/container';
import { toCartDto } from '../../../application/cart/CartDto';
import { jsonResponse } from '../../../lib/http/jsonResponse';
import { toErrorResponse } from '../../../lib/http/errorResponse';
import { CART_COOKIE_NAME, setCartCookie } from '../../../lib/http/cartCookie';

export const prerender = false;

export const GET: APIRoute = async ({ cookies }) => {
  try {
    const existingCartId = cookies.get(CART_COOKIE_NAME)?.value;
    const cart = await container.getOrCreateCart.execute(existingCartId);
    setCartCookie(cookies, cart.id.toString());
    return jsonResponse(toCartDto(cart));
  } catch (error) {
    return toErrorResponse(error);
  }
};
