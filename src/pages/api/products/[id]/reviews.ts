import type { APIRoute } from 'astro';
import { container } from '../../../../infrastructure/di/container';
import { writeReviewSchema } from '../../../../lib/validation/reviewSchemas';
import { jsonResponse } from '../../../../lib/http/jsonResponse';
import { toErrorResponse } from '../../../../lib/http/errorResponse';
import { requireUser } from '../../../../lib/http/requireUser';

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  try {
    const viewer = locals.user ? { id: locals.user.id, role: locals.user.role } : null;
    return jsonResponse(await container.getProductReviews.execute(params.id!, viewer));
  } catch (error) {
    return toErrorResponse(error);
  }
};

export const POST: APIRoute = async ({ params, request, locals }) => {
  try {
    const requestingUser = requireUser(locals.user);
    const input = writeReviewSchema.parse(await request.json());
    const review = await container.writeReview.execute(
      { productId: params.id!, rating: input.rating, comment: input.comment },
      requestingUser,
    );
    return jsonResponse(review, 201);
  } catch (error) {
    return toErrorResponse(error);
  }
};
