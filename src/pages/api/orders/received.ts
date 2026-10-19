import type { APIRoute } from 'astro';
import { container } from '../../../infrastructure/di/container';
import { jsonResponse } from '../../../lib/http/jsonResponse';
import { toErrorResponse } from '../../../lib/http/errorResponse';
import { requireUser } from '../../../lib/http/requireUser';
import { ForbiddenError } from '../../../domain/shared/DomainError';
import { pageQueryFrom } from '../../../lib/validation/paginationSchemas';

export const prerender = false;

export const GET: APIRoute = async ({ locals, url }) => {
  try {
    const requestingUser = requireUser(locals.user);
    if (requestingUser.role !== 'seller') {
      throw new ForbiddenError('Only sellers can view orders received');
    }
    return jsonResponse(
      await container.listOrdersForVendor.execute(requestingUser.id, pageQueryFrom(url)),
    );
  } catch (error) {
    return toErrorResponse(error);
  }
};
