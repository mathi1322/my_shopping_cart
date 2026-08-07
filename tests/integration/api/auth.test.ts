import { beforeEach, describe, expect, it } from 'vitest';
import { POST as register } from '@/pages/api/auth/register';
import { POST as login } from '@/pages/api/auth/login';
import { POST as logout } from '@/pages/api/auth/logout';
import { GET as me } from '@/pages/api/auth/me';
import { createTestDb, truncateAll } from '../setupDb';
import { callRoute, createFakeCookies, jsonRequest } from './_httpTestUtils';

const { db } = createTestDb();

describe('Auth API', () => {
  beforeEach(async () => {
    await truncateAll(db);
  });

  it('registers a new user, returns 201, and sets a session cookie', async () => {
    const cookies = createFakeCookies();

    const response = await callRoute(register, {
      request: jsonRequest('http://localhost/api/auth/register', 'POST', {
        email: 'seller@example.com',
        password: 'password123',
        role: 'seller',
      }),
      cookies,
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.email).toBe('seller@example.com');
    expect(body.role).toBe('seller');
    expect(body).not.toHaveProperty('password');
    expect(cookies.get('sessionId')).toBeDefined();
  });

  it('rejects registering a duplicate email with 409', async () => {
    await callRoute(register, {
      request: jsonRequest('http://localhost/api/auth/register', 'POST', {
        email: 'dup@example.com',
        password: 'password123',
        role: 'buyer',
      }),
    });

    const response = await callRoute(register, {
      request: jsonRequest('http://localhost/api/auth/register', 'POST', {
        email: 'dup@example.com',
        password: 'password456',
        role: 'seller',
      }),
    });

    expect(response.status).toBe(409);
  });

  it('rejects a weak password with 400', async () => {
    const response = await callRoute(register, {
      request: jsonRequest('http://localhost/api/auth/register', 'POST', {
        email: 'weak@example.com',
        password: 'short',
        role: 'buyer',
      }),
    });

    expect(response.status).toBe(400);
  });

  it('logs in with correct credentials and sets a session cookie', async () => {
    await callRoute(register, {
      request: jsonRequest('http://localhost/api/auth/register', 'POST', {
        email: 'buyer@example.com',
        password: 'password123',
        role: 'buyer',
      }),
    });

    const cookies = createFakeCookies();
    const response = await callRoute(login, {
      request: jsonRequest('http://localhost/api/auth/login', 'POST', {
        email: 'buyer@example.com',
        password: 'password123',
      }),
      cookies,
    });

    expect(response.status).toBe(200);
    expect(cookies.get('sessionId')).toBeDefined();
  });

  it('returns 401 for a wrong password', async () => {
    await callRoute(register, {
      request: jsonRequest('http://localhost/api/auth/register', 'POST', {
        email: 'buyer2@example.com',
        password: 'password123',
        role: 'buyer',
      }),
    });

    const response = await callRoute(login, {
      request: jsonRequest('http://localhost/api/auth/login', 'POST', {
        email: 'buyer2@example.com',
        password: 'wrong-password',
      }),
    });

    expect(response.status).toBe(401);
  });

  it('returns 401 for an unknown email', async () => {
    const response = await callRoute(login, {
      request: jsonRequest('http://localhost/api/auth/login', 'POST', {
        email: 'nobody@example.com',
        password: 'whatever123',
      }),
    });

    expect(response.status).toBe(401);
  });

  it('GET /api/auth/me reflects the resolved locals.user (session -> user is done in middleware)', async () => {
    const anonResponse = await callRoute(me, {
      request: jsonRequest('http://localhost/api/auth/me', 'GET'),
    });
    expect((await anonResponse.json()).user).toBeNull();

    const registerResponse = await callRoute(register, {
      request: jsonRequest('http://localhost/api/auth/register', 'POST', {
        email: 'me@example.com',
        password: 'password123',
        role: 'buyer',
      }),
    });
    const registeredUser = await registerResponse.json();

    const meResponse = await callRoute(me, {
      request: jsonRequest('http://localhost/api/auth/me', 'GET'),
      user: registeredUser,
    });
    expect((await meResponse.json()).user.email).toBe('me@example.com');
  });

  it('logout clears the session cookie', async () => {
    const cookies = createFakeCookies();
    await callRoute(register, {
      request: jsonRequest('http://localhost/api/auth/register', 'POST', {
        email: 'logout@example.com',
        password: 'password123',
        role: 'buyer',
      }),
      cookies,
    });
    expect(cookies.get('sessionId')).toBeDefined();

    const response = await callRoute(logout, {
      request: jsonRequest('http://localhost/api/auth/logout', 'POST'),
      cookies,
    });

    expect(response.status).toBe(204);
    expect(cookies.get('sessionId')).toBeUndefined();
  });
});
