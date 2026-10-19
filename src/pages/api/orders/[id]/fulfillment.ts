import type { APIRoute } from 'astro';
import { container } from '../../../../infrastructure/di/container';
import { advanceFulfillmentSchema } from '../../../../lib/validation/orderSchemas';
import { jsonResponse } from '../../../../lib/http/jsonResponse';
import { toErrorResponse } from '../../../../lib/http/errorResponse';
import { requireUser } from '../../../../lib/http/requireUser';

export const prerender = false;

/** A seller marks their items in the order as shipped or delivered. */
export const POST: APIRoute = async ({ params, request, locals }) => {
  try {
    const requestingUser = requireUser(locals.user);
    const input = advanceFulfillmentSchema.parse(await request.json());
    const order = await container.advanceOrderFulfillment.execute(
      { orderId: params.id!, status: input.status },
      requestingUser,
    );
    return jsonResponse(order);
  } catch (error) {
    return toErrorResponse(error);
  }
};
