import { defineMiddleware } from 'astro:middleware';
import { container } from './infrastructure/di/container';
import { SESSION_COOKIE_NAME } from './lib/http/authCookie';

export const onRequest = defineMiddleware(async (context, next) => {
  const sessionId = context.cookies.get(SESSION_COOKIE_NAME)?.value;
  context.locals.user = sessionId ? await container.resolveSession.execute(sessionId) : null;
  return next();
});
