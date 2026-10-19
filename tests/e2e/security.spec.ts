import { test, expect, registerViaApi } from './fixtures';

// These exercise the HTTP layer, not the browser, so one engine is enough.
test.skip(({ browserName }) => browserName !== 'chromium', 'HTTP-level checks');

test('pages are served with baseline security headers', async ({ request }) => {
  const response = await request.get('/');
  expect(response.status()).toBe(200);
  const headers = response.headers();
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toContain('camera=()');
});

test('cross-site requests cannot change state', async ({ request }) => {
  await registerViaApi(request, 'buyer');

  const textPlain = await request.post('/api/orders', {
    headers: { 'Content-Type': 'text/plain' },
    data: '{"deliveryAddress":"x","deliveryPhone":"1"}',
  });
  expect(textPlain.status()).toBe(415);

  const crossSiteForm = await request.post('/api/orders', {
    headers: { Origin: 'https://evil.example' },
    form: { deliveryAddress: 'x', deliveryPhone: '1' },
  });
  expect(crossSiteForm.status()).toBe(403);

  const crossSiteLogout = await request.post('/api/auth/logout', {
    headers: { Origin: 'https://evil.example' },
  });
  expect(crossSiteLogout.status()).toBe(403);
  // ...and the session survived it.
  expect((await (await request.get('/api/auth/me')).json()).user).not.toBeNull();
});

test('repeated failed logins are rate limited', async ({ request }) => {
  const account = await registerViaApi(request, 'buyer');
  const attempt = () =>
    request.post('/api/auth/login', { data: { email: account.email, password: 'wrong' } });

  for (let i = 0; i < 10; i += 1) {
    expect((await attempt()).status()).toBe(401);
  }
  const limited = await attempt();
  expect(limited.status()).toBe(429);
  expect(Number(limited.headers()['retry-after'])).toBeGreaterThan(0);
});
