import type { APIRoute } from 'astro';
import { container } from '../../../infrastructure/di/container';
import { presentCart } from '../../../application/cart/CartDto';
import { jsonResponse } from '../../../lib/http/jsonResponse';
import { toErrorResponse } from '../../../lib/http/errorResponse';
import { requireUser } from '../../../lib/http/requireUser';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  try {
    const requestingUser = requireUser(locals.user);
    const cart = await container.getOrCreateCart.execute(requestingUser.id);
    return jsonResponse(await presentCart(cart, container.vendorDirectory));
  } catch (error) {
    return toErrorResponse(error);
  }
};
