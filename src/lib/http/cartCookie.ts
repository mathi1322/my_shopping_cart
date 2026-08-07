import type { AstroCookies } from 'astro';

export const CART_COOKIE_NAME = 'cartId';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export function setCartCookie(cookies: AstroCookies, cartId: string): void {
  cookies.set(CART_COOKIE_NAME, cartId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}
