import type { AstroCookies } from 'astro';

export const SESSION_COOKIE_NAME = 'sessionId';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days — matches DrizzleSessionStore's TTL

/**
 * HTTPS-only in production builds. Browsers also accept Secure cookies on
 * http://localhost, so the Docker demo still works; set COOKIE_SECURE=false
 * only for a non-localhost plain-HTTP setup.
 */
const SECURE = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === 'true'
  : import.meta.env.PROD;

export function setSessionCookie(cookies: AstroCookies, sessionId: string): void {
  cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: SECURE,
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(cookies: AstroCookies): void {
  cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
}
