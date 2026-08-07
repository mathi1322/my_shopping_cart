import type { APIRoute } from 'astro';
import { container } from '../../../infrastructure/di/container';
import { updateProductSchema } from '../../../lib/validation/productSchemas';
import { jsonResponse } from '../../../lib/http/jsonResponse';
import { toErrorResponse } from '../../../lib/http/errorResponse';
import { requireUser } from '../../../lib/http/requireUser';

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  try {
    const product = await container.getProduct.execute(params.id!);
    return jsonResponse(product);
  } catch (error) {
    return toErrorResponse(error);
  }
};

export const PUT: APIRoute = async ({ params, request, locals }) => {
  try {
    const requestingUser = requireUser(locals.user);
    const body = await request.json();
    const input = updateProductSchema.parse(body);
    const product = await container.updateProduct.execute(params.id!, input, requestingUser);
    return jsonResponse(product);
  } catch (error) {
    return toErrorResponse(error);
  }
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  try {
    const requestingUser = requireUser(locals.user);
    await container.deleteProduct.execute(params.id!, requestingUser);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
};
