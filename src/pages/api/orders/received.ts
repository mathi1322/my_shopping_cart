import type { APIRoute } from 'astro';
import { container } from '../../../infrastructure/di/container';
import { jsonResponse } from '../../../lib/http/jsonResponse';
import { toErrorResponse } from '../../../lib/http/errorResponse';
import { requireUser } from '../../../lib/http/requireUser';
import { ForbiddenError } from '../../../domain/shared/DomainError';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  try {
    const requestingUser = requireUser(locals.user);
    if (requestingUser.role !== 'seller') {
      throw new ForbiddenError('Only sellers can view orders received');
    }
    const orders = await container.listOrdersForVendor.execute(requestingUser.id);
    return jsonResponse({ orders });
  } catch (error) {
    return toErrorResponse(error);
  }
};
