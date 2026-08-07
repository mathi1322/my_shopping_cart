import type { AstroCookies } from 'astro';

export const SESSION_COOKIE_NAME = 'sessionId';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days — matches DrizzleSessionStore's TTL

export function setSessionCookie(cookies: AstroCookies, sessionId: string): void {
  cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie(cookies: AstroCookies): void {
  cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
}
