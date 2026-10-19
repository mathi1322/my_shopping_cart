import type { APIContext, APIRoute } from 'astro';
import type { UserDto } from '@/application/identity/UserDto';

interface FakeCookieJar {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string): void;
  has(name: string): boolean;
  delete(name: string): void;
}

export function createFakeCookies(): FakeCookieJar {
  const store = new Map<string, string>();
  return {
    get: (name) => {
      const value = store.get(name);
      return value !== undefined ? { value } : undefined;
    },
    set: (name, value) => {
      store.set(name, value);
    },
    has: (name) => store.has(name),
    delete: (name) => {
      store.delete(name);
    },
  };
}

export async function callRoute(
  handler: APIRoute,
  options: {
    request: Request;
    params?: Record<string, string>;
    cookies?: FakeCookieJar;
    user?: UserDto | null;
    clientAddress?: string;
  },
): Promise<Response> {
  const context = {
    request: options.request,
    params: options.params ?? {},
    cookies: options.cookies ?? createFakeCookies(),
    url: new URL(options.request.url),
    locals: { user: options.user ?? null },
    clientAddress: options.clientAddress ?? '127.0.0.1',
  } as unknown as APIContext;

  const response = await handler(context);
  return response as Response;
}

export function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
