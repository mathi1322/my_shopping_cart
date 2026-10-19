import type { APIRoute } from 'astro';
import { container } from '../../../infrastructure/di/container';
import { createProductSchema } from '../../../lib/validation/productSchemas';
import { jsonResponse } from '../../../lib/http/jsonResponse';
import { toErrorResponse } from '../../../lib/http/errorResponse';
import { requireUser } from '../../../lib/http/requireUser';
import { pageQueryFrom } from '../../../lib/validation/paginationSchemas';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const params = url.searchParams;
    const result = await container.searchProducts.execute({
      ...pageQueryFrom(url),
      vendorId: params.get('vendorId') ?? undefined,
      text: params.get('q') ?? undefined,
      categories: params.getAll('category'),
      inStockOnly: params.get('inStock') === '1',
    });
    return jsonResponse(result);
  } catch (error) {
    return toErrorResponse(error);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const requestingUser = requireUser(locals.user);
    const body = await request.json();
    const input = createProductSchema.parse(body);
    const product = await container.createProduct.execute(input, requestingUser);
    return jsonResponse(product, 201);
  } catch (error) {
    return toErrorResponse(error);
  }
};
