import {
  test,
  expect,
  PASSWORD,
  createProductViaApi,
  gotoHydrated,
  inrWhole,
  registerViaApi,
  uniqueSuffix,
} from './fixtures';

test('a seller registers, lists a product, edits it, and deletes it', async ({ page }) => {
  await gotoHydrated(page, '/register');
  await page.getByLabel('Email').fill(`seller-${uniqueSuffix()}@e2e.test`);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByLabel('Sell products (seller)').check();
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/sell$/);
  await expect(page.getByRole('heading', { name: 'My Products' })).toBeVisible();
  await page.waitForFunction(() => document.querySelectorAll('astro-island[ssr]').length === 0);

  const name = `E2E Pulse Oximeter ${uniqueSuffix()}`;
  await page.getByPlaceholder('Product name').fill(name);
  await page.getByPlaceholder('Description').fill('Fingertip SpO2 meter');
  await page.getByPlaceholder('Price (INR)').fill('1299');
  await page.getByPlaceholder('Stock quantity').fill('7');

  // Plain-http images are rejected as soon as they're added (no preview, nothing sent).
  await page.getByPlaceholder('Image URL (https://…)').fill('http://cdn.example/oximeter.jpg');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Image URLs must start with https://');
  await expect(page.getByRole('button', { name: 'Remove image' })).toHaveCount(0);

  await page.getByPlaceholder('Image URL (https://…)').fill('https://127.0.0.1:9/oximeter.jpg');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Remove image' })).toHaveCount(1);
  await page.getByRole('button', { name: /add product/i }).click();

  const listing = page.getByRole('listitem').filter({ hasText: name });
  await expect(listing.getByText('7 in stock')).toBeVisible();

  // Edit the stock (the edit form re-sends the images too).
  await listing.getByRole('button', { name: /edit/i }).click();
  const editor = page
    .getByRole('listitem')
    .filter({ has: page.getByRole('button', { name: /save/i }) });
  await editor.getByLabel('Stock quantity').fill('4');
  await editor.getByRole('button', { name: /save/i }).click();
  await expect(
    page.getByRole('listitem').filter({ hasText: name }).getByText('4 in stock'),
  ).toBeVisible();

  // The public catalog shows the listing.
  const products = await (await page.request.get('/api/products')).json();
  expect(products.products.some((p: { name: string }) => p.name === name)).toBe(true);

  page.once('dialog', (dialog) => dialog.accept());
  await page
    .getByRole('listitem')
    .filter({ hasText: name })
    .getByRole('button', { name: /delete/i })
    .click();
  await expect(page.getByText("You haven't listed any products yet.")).toBeVisible();
});

test('the seller dashboard and orders-received pages reflect a sale', async ({ page, newApi }) => {
  await registerViaApi(page.request, 'seller');
  const product = await createProductViaApi(page.request, { priceInCents: 25_000 });

  const buyer = await newApi();
  await registerViaApi(buyer, 'buyer');
  await buyer.post('/api/cart/items', { data: { productId: product.id, quantity: 2 } });
  const order = await buyer.post('/api/orders', {
    data: { deliveryAddress: '1 Test Street', deliveryPhone: '9876543210' },
  });
  expect(order.status()).toBe(201);

  await gotoHydrated(page, '/sell/orders');
  await expect(page.getByRole('heading', { name: 'Orders Received' })).toBeVisible();
  await expect(page.getByText(product.name).first()).toBeVisible();

  await gotoHydrated(page, '/sell/dashboard');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  // The name also appears in hidden SVG tooltips, so look for a visible copy.
  await expect(page.getByText(product.name).filter({ visible: true }).first()).toBeVisible();
  await expect(
    page
      .getByText(inrWhole(2 * 25_000))
      .filter({ visible: true })
      .first(),
  ).toBeVisible();
});
