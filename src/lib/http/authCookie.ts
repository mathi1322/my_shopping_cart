import type { AstroCookies } from 'astro';

export const SESSION_COOKIE_NAME = 'sessionId';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days — matches DrizzleSessionStore's TTL

/**
 * Secure whenever the request arrived over HTTPS — directly, or via a trusted
 * proxy's X-Forwarded-Proto (see ALLOWED_HOSTS in astro.config.mjs). Not on
 * plain-HTTP localhost, because Safari drops Secure cookies there and login
 * would silently fail. COOKIE_SECURE=true|false overrides the detection.
 */
function isSecureRequest(requestUrl: URL): boolean {
  const override = process.env.COOKIE_SECURE;
  if (override === 'true' || override === 'false') {
    return override === 'true';
  }
  return requestUrl.protocol === 'https:';
}

export function setSessionCookie(cookies: AstroCookies, sessionId: string, requestUrl: URL): void {
  cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecureRequest(requestUrl),
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(cookies: AstroCookies): void {
  cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
}
