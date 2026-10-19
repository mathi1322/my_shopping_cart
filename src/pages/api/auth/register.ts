import type { APIRoute } from 'astro';
import { container } from '../../../infrastructure/di/container';
import { registerSchema } from '../../../lib/validation/authSchemas';
import { jsonResponse } from '../../../lib/http/jsonResponse';
import { toErrorResponse } from '../../../lib/http/errorResponse';
import { SESSION_COOKIE_NAME, setSessionCookie } from '../../../lib/http/authCookie';
import { registerPerClientLimiter } from '../../../lib/http/rateLimit';

export const prerender = false;

export const POST: APIRoute = async ({ request, cookies, clientAddress, url }) => {
  try {
    const body = await request.json();
    const input = registerSchema.parse(body);

    registerPerClientLimiter.hit(clientAddress);

    const user = await container.registerUser.execute(input);
    // Rotate: never leave a previous session alive alongside the new one.
    const previousSessionId = cookies.get(SESSION_COOKIE_NAME)?.value;
    if (previousSessionId) {
      await container.sessionStore.destroy(previousSessionId);
    }
    const sessionId = await container.sessionStore.create(user.id);
    setSessionCookie(cookies, sessionId, url);

    return jsonResponse(user, 201);
  } catch (error) {
    return toErrorResponse(error);
  }
};
