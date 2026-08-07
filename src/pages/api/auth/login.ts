import type { APIRoute } from 'astro';
import { container } from '../../../infrastructure/di/container';
import { loginSchema } from '../../../lib/validation/authSchemas';
import { jsonResponse } from '../../../lib/http/jsonResponse';
import { toErrorResponse } from '../../../lib/http/errorResponse';
import { setSessionCookie } from '../../../lib/http/authCookie';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const body = await request.json();
    const input = loginSchema.parse(body);

    const user = await container.authenticateUser.execute(input);
    const sessionId = await container.sessionStore.create(user.id);
    setSessionCookie(cookies, sessionId);

    return jsonResponse(user);
  } catch (error) {
    return toErrorResponse(error);
  }
};
