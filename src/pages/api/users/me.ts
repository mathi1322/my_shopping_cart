import type { APIRoute } from 'astro';
import { container } from '../../../infrastructure/di/container';
import { updateProfileSchema } from '../../../lib/validation/profileSchemas';
import { jsonResponse } from '../../../lib/http/jsonResponse';
import { toErrorResponse } from '../../../lib/http/errorResponse';
import { requireUser } from '../../../lib/http/requireUser';

export const prerender = false;

/** A field explicitly cleared in the form arrives as ''; store that as no-value rather than an empty string. */
function emptyToNull(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value === '' ? null : value;
}

export const PUT: APIRoute = async ({ request, locals }) => {
  try {
    const requestingUser = requireUser(locals.user);
    const body = await request.json();
    const input = updateProfileSchema.parse(body);

    const user = await container.updateUserProfile.execute(requestingUser.id, {
      name: emptyToNull(input.name),
      phone: emptyToNull(input.phone),
      address: emptyToNull(input.address),
      companyName: emptyToNull(input.companyName),
      companyAddress: emptyToNull(input.companyAddress),
      gstNumber: emptyToNull(input.gstNumber),
    });

    return jsonResponse(user);
  } catch (error) {
    return toErrorResponse(error);
  }
};
