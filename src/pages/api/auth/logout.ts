import type { APIRoute } from 'astro';
import { container } from '../../../infrastructure/di/container';
import { SESSION_COOKIE_NAME, clearSessionCookie } from '../../../lib/http/authCookie';
import { toErrorResponse } from '../../../lib/http/errorResponse';

export const prerender = false;

export const POST: APIRoute = async ({ cookies }) => {
  try {
    const sessionId = cookies.get(SESSION_COOKIE_NAME)?.value;
    if (sessionId) {
      await container.sessionStore.destroy(sessionId);
    }
    clearSessionCookie(cookies);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error);
  }
};
