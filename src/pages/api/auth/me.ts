import type { APIRoute } from 'astro';
import { jsonResponse } from '../../../lib/http/jsonResponse';

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  return jsonResponse({ user: locals.user });
};
