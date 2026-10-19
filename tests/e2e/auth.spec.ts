import { test, expect, createProductViaApi, gotoHydrated, registerViaApi } from './fixtures';

test('login shows an error for a wrong password, then succeeds with the right one', async ({
  page,
  newApi,
  context,
}) => {
  const account = await registerViaApi(await newApi(), 'buyer');

  await gotoHydrated(page, '/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill('wrong-password');
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page.getByText('Invalid email or password')).toBeVisible();
  // The password must never end up in the URL (a pre-hydration native submit would do that).
  expect(page.url()).not.toContain('password');

  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();

  const session = (await context.cookies()).find((cookie) => cookie.name === 'sessionId');
  expect(session).toBeDefined();
  expect(session!.httpOnly).toBe(true);
  // Secure exactly when served over HTTPS; on plain-HTTP localhost Safari would drop it.
  expect(session!.secure).toBe(page.url().startsWith('https:'));
  expect(session!.sameSite).toBe('Lax');
});

test('logout ends the session', async ({ page }) => {
  await registerViaApi(page.request, 'buyer');
  await gotoHydrated(page, '/');

  await page.getByRole('button', { name: 'Account menu' }).click();
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();

  const me = await (await page.request.get('/api/auth/me')).json();
  expect(me.user).toBeNull();
});

test('adding to cart while logged out opens the login modal, then adds the item', async ({
  page,
  newApi,
}) => {
  const seller = await newApi();
  await registerViaApi(seller, 'seller');
  const product = await createProductViaApi(seller);
  const buyer = await registerViaApi(await newApi(), 'buyer');

  await gotoHydrated(page, `/products/${product.id}`);
  await page.getByRole('button', { name: /add to cart/i }).click();

  await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  await page.getByLabel('Email').fill(buyer.email);
  await page.getByLabel('Password').fill(buyer.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();

  await expect(page.getByText('Added ✓')).toBeVisible();
  const cart = await (await page.request.get('/api/cart')).json();
  expect(cart.items[0].productId).toBe(product.id);
});

test('protected pages redirect anonymous visitors and buyers', async ({ page }) => {
  await page.goto('/orders');
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/sell');
  await expect(page).toHaveURL(/\/login$/);

  await registerViaApi(page.request, 'buyer');
  await page.goto('/sell/dashboard');
  await expect(page).toHaveURL(/\/$/);
  await page.goto('/login');
  await expect(page).toHaveURL(/\/$/);
});

test('login works with the keyboard alone', async ({ page, newApi }) => {
  const account = await registerViaApi(await newApi(), 'buyer');

  await gotoHydrated(page, '/login');
  await page.getByLabel('Email').focus();
  await page.keyboard.type(account.email);
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Password')).toBeFocused();
  await page.keyboard.type(account.password);
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
});
