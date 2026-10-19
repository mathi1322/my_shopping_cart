import { defineMiddleware } from 'astro:middleware';
import { container } from './infrastructure/di/container';
import { SESSION_COOKIE_NAME } from './lib/http/authCookie';

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * API bodies are JSON only. Rejecting other content types means a cross-site
 * form or text/plain post can't reach a handler, even from a client that omits
 * the Origin header Astro's checkOrigin relies on. Body-less requests pass.
 */
function hasNonJsonBody(request: Request): boolean {
  const contentType = request.headers.get('content-type');
  return contentType !== null && !contentType.toLowerCase().startsWith('application/json');
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (
    context.url.pathname.startsWith('/api/') &&
    !SAFE_METHODS.has(context.request.method) &&
    hasNonJsonBody(context.request)
  ) {
    return new Response(
      JSON.stringify({
        error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Request body must be application/json' },
      }),
      { status: 415, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const sessionId = context.cookies.get(SESSION_COOKIE_NAME)?.value;
  context.locals.user = sessionId ? await container.resolveSession.execute(sessionId) : null;

  const response = await next();
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    try {
      response.headers.set(name, value);
    } catch {
      // Some responses (e.g. Response.redirect) have immutable headers; skip those.
    }
  }
  return response;
});
