import type { APIRoute } from 'astro';
import { container } from '../../../../infrastructure/di/container';
import { jsonResponse } from '../../../../lib/http/jsonResponse';
import { toErrorResponse } from '../../../../lib/http/errorResponse';
import { requireUser } from '../../../../lib/http/requireUser';

export const prerender = false;

export const POST: APIRoute = async ({ params, locals }) => {
  try {
    const requestingUser = requireUser(locals.user);
    const order = await container.cancelOrder.execute({
      orderId: params.id!,
      requestingUserId: requestingUser.id,
    });
    return jsonResponse(order);
  } catch (error) {
    return toErrorResponse(error);
  }
};
