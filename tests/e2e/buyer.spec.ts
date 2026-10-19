import {
  test,
  expect,
  PASSWORD,
  createProductViaApi,
  gotoHydrated,
  inr,
  registerViaApi,
  stockOf,
  uniqueSuffix,
} from './fixtures';

test('a buyer registers, buys a product, sees the order, and cancels it', async ({
  page,
  newApi,
}) => {
  const seller = await newApi();
  await registerViaApi(seller, 'seller');
  const product = await createProductViaApi(seller, { priceInCents: 49_900, stockQuantity: 5 });

  // Register through the UI.
  await gotoHydrated(page, '/register');
  await page.getByLabel('Email').fill(`buyer-${uniqueSuffix()}@e2e.test`);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByLabel('Shop (buyer)').check();
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/$/);

  // Add two units from the product page.
  await gotoHydrated(page, `/products/${product.id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(product.name);
  await page.getByRole('button', { name: 'Increase quantity' }).click();
  await page.getByRole('button', { name: /add to cart/i }).click();
  await expect(page.getByText('Added ✓')).toBeVisible();

  // Cart shows the right count and total.
  await gotoHydrated(page, '/cart');
  await expect(page.getByText('My Cart (2)')).toBeVisible();
  await expect(page.getByText(inr(2 * 49_900)).first()).toBeVisible();

  // Checkout: delivery details → confirm.
  await page.getByRole('button', { name: /place order/i }).click();
  await page.getByLabel('Delivery address').fill('221B Baker Street, London');
  await page.getByLabel('Phone number').fill('9876543210');
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Confirm your order' })).toBeVisible();
  await page.getByRole('button', { name: /confirm order/i }).click();

  await expect(page).toHaveURL(/\/orders\?placed=1/);
  await expect(page.getByRole('link', { name: product.name }).first()).toBeVisible();
  await expect(page.getByText('Placed', { exact: true })).toBeVisible();
  expect(await stockOf(page.request, product.id)).toBe(3);

  // The cart is empty afterwards.
  const cart = await (await page.request.get('/api/cart')).json();
  expect(cart.items).toHaveLength(0);

  // The seller sees the order, narrowed to their own item.
  const received = await (await seller.get('/api/orders/received')).json();
  expect(received.orders).toHaveLength(1);
  expect(received.orders[0].items[0].productId).toBe(product.id);

  // Cancel it; stock comes back.
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: /cancel order/i }).click();
  await expect(page.getByText('Cancelled', { exact: true })).toBeVisible();
  expect(await stockOf(page.request, product.id)).toBe(5);
});

test('checkout is refused and the cart repriced when the seller changes the price', async ({
  page,
  newApi,
}) => {
  const seller = await newApi();
  await registerViaApi(seller, 'seller');
  const product = await createProductViaApi(seller, { priceInCents: 49_900 });

  await registerViaApi(page.request, 'buyer');
  await page.request.post('/api/cart/items', { data: { productId: product.id, quantity: 1 } });

  await gotoHydrated(page, '/cart');
  await page.getByRole('button', { name: /place order/i }).click();
  await page.getByLabel('Delivery address').fill('1 Test Street');
  await page.getByLabel('Phone number').fill('9876543210');
  await page.getByRole('button', { name: 'Continue' }).click();

  // The seller raises the price while the buyer is on the confirm step.
  const update = await seller.put(`/api/products/${product.id}`, {
    data: { priceInCents: 59_900 },
  });
  expect(update.status()).toBe(200);

  await page.getByRole('button', { name: /confirm order/i }).click();
  await expect(page.getByText(/price of .* has changed/i)).toBeVisible();
  // The confirm step now shows the new total, so the buyer knows what they'll pay.
  await expect(page.getByText(inr(59_900)).first()).toBeVisible();
  expect(await stockOf(page.request, product.id)).toBe(5);

  await page.getByRole('button', { name: /confirm order/i }).click();
  await expect(page).toHaveURL(/\/orders\?placed=1/);
  const { orders } = await (await page.request.get('/api/orders')).json();
  expect(orders[0].totalInCents).toBe(59_900);
});

test('checkout is refused when stock ran out after adding to cart', async ({ page, newApi }) => {
  const seller = await newApi();
  await registerViaApi(seller, 'seller');
  const product = await createProductViaApi(seller, { stockQuantity: 1 });

  await registerViaApi(page.request, 'buyer');
  await page.request.post('/api/cart/items', { data: { productId: product.id, quantity: 1 } });
  await seller.put(`/api/products/${product.id}`, { data: { stockQuantity: 0 } });

  await gotoHydrated(page, '/cart');
  await page.getByRole('button', { name: /place order/i }).click();
  await page.getByLabel('Delivery address').fill('1 Test Street');
  await page.getByLabel('Phone number').fill('9876543210');
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: /confirm order/i }).click();

  await expect(page.getByText(/only 0 unit\(s\)/i)).toBeVisible();
  await expect(page).toHaveURL(/\/cart$/);
});

test('cart quantity can be changed and items removed', async ({ page, newApi }) => {
  const seller = await newApi();
  await registerViaApi(seller, 'seller');
  const product = await createProductViaApi(seller, { priceInCents: 10_000, stockQuantity: 5 });

  await registerViaApi(page.request, 'buyer');
  await page.request.post('/api/cart/items', { data: { productId: product.id, quantity: 1 } });

  await gotoHydrated(page, '/cart');
  await page.getByRole('button', { name: `Increase quantity for ${product.name}` }).click();
  await expect(page.getByText('My Cart (2)')).toBeVisible();
  await expect(page.getByText(inr(20_000)).first()).toBeVisible();

  await page.getByRole('button', { name: /remove/i }).click();
  await expect(page.getByText('Your cart is empty')).toBeVisible();
});
