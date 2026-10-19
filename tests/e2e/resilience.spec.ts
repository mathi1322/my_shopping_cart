import { test, expect, createProductViaApi, gotoHydrated, registerViaApi } from './fixtures';

test('the cart page shows an error instead of hanging when the API fails', async ({ page }) => {
  await registerViaApi(page.request, 'buyer');
  await page.route(/\/api\/cart(\?|$)/, (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Database unavailable' } }),
    }),
  );

  await gotoHydrated(page, '/cart');
  await expect(page.getByRole('alert')).toContainText('Database unavailable');
});

test('the orders page shows an error when the network is down', async ({ page }) => {
  await registerViaApi(page.request, 'buyer');
  await page.route(/\/api\/orders(\?|$)/, (route) => route.abort('internetdisconnected'));

  await gotoHydrated(page, '/orders');
  await expect(page.getByRole('alert')).toContainText('Network error');
});

test('a cart action after the session expired shows a message, not a crash', async ({
  page,
  newApi,
}) => {
  const seller = await newApi();
  await registerViaApi(seller, 'seller');
  const product = await createProductViaApi(seller);

  await registerViaApi(page.request, 'buyer');
  await page.request.post('/api/cart/items', { data: { productId: product.id, quantity: 1 } });
  await gotoHydrated(page, '/cart');
  await expect(page.getByText('My Cart (1)')).toBeVisible();

  // The session ends (e.g. it expired, or the user logged out in another tab).
  await page.request.post('/api/auth/logout');

  await page.getByRole('button', { name: `Increase quantity for ${product.name}` }).click();
  await expect(page.getByText('You must be logged in to do this')).toBeVisible();
});

test('seller pages show an error when loading fails', async ({ page }) => {
  await registerViaApi(page.request, 'seller');
  await page.route('**/api/products?vendorId=*', (route) => route.abort('failed'));
  await page.route(/\/api\/orders\/received(\?|$)/, (route) =>
    route.fulfill({ status: 503, contentType: 'text/html', body: '<h1>Bad gateway</h1>' }),
  );

  await gotoHydrated(page, '/sell');
  await expect(page.getByText(/could not load your products: network error/i)).toBeVisible();

  await gotoHydrated(page, '/sell/orders');
  await expect(page.getByRole('alert')).toContainText('Something went wrong (503)');
});
