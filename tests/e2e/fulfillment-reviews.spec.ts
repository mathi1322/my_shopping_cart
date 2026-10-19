import {
  test,
  expect,
  buyViaApi,
  createProductViaApi,
  gotoHydrated,
  registerViaApi,
  setCompanyName,
  uniqueSuffix,
} from './fixtures';

test('a seller ships and delivers an order, then the buyer reviews the product', async ({
  page,
  browser,
  baseURL,
}) => {
  // Seller, in their own browser context.
  const sellerContext = await browser.newContext({ baseURL });
  const sellerPage = await sellerContext.newPage();
  await registerViaApi(sellerPage.request, 'seller');
  const company = `CareWell Medical ${uniqueSuffix()}`;
  await setCompanyName(sellerPage.request, company);
  const product = await createProductViaApi(sellerPage.request);

  // Buyer orders it.
  await registerViaApi(page.request, 'buyer');
  await page.request.put('/api/users/me', { data: { name: 'Asha K' } });
  await buyViaApi(page.request, product.id);

  // The buyer sees the seller's name, not an id, and can still cancel while it's placed.
  await gotoHydrated(page, '/orders');
  await expect(page.getByText(`Sold by ${company}`)).toBeVisible();
  await expect(page.getByRole('button', { name: /cancel order/i })).toBeVisible();

  // The seller marks it shipped, then delivered.
  await gotoHydrated(sellerPage, '/sell/orders');
  await sellerPage.getByRole('button', { name: 'Mark as shipped' }).click();
  await expect(sellerPage.getByText('Shipped', { exact: true })).toBeVisible();

  // Once shipped, the buyer can no longer cancel.
  await gotoHydrated(page, '/orders');
  await expect(page.getByText('Shipped', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: /cancel order/i })).toHaveCount(0);

  await sellerPage.getByRole('button', { name: 'Mark as delivered' }).click();
  await expect(sellerPage.getByText('Delivered', { exact: true })).toBeVisible();
  await expect(sellerPage.getByRole('button', { name: /mark as/i })).toHaveCount(0);
  await sellerContext.close();

  // The buyer follows "Write a review" from their order.
  await gotoHydrated(page, '/orders');
  await page.getByRole('link', { name: 'Write a review' }).click();
  await page.waitForFunction(() => document.querySelectorAll('astro-island[ssr]').length === 0);
  await expect(page.getByRole('heading', { name: 'Write a review' })).toBeVisible();

  await page.getByRole('button', { name: 'Submit review' }).click();
  await expect(page.getByRole('alert')).toContainText('Choose a rating');

  // The radios are visually hidden behind the stars; click the star, as a user would.
  await page
    .locator('label')
    .filter({ has: page.getByLabel('4 stars — Very good') })
    .click();
  await expect(page.getByLabel('4 stars — Very good')).toBeChecked();
  await page.getByLabel('Your review (optional)').fill('Quick and accurate readings.');
  await page.getByRole('button', { name: 'Submit review' }).click();

  await expect(page.getByText('Quick and accurate readings.')).toBeVisible();
  await expect(page.getByText('Verified purchase')).toBeVisible();
  await expect(page.getByText('Asha K')).toBeVisible();
  await expect(page.getByText('4.0 out of 5')).toBeVisible();
  await expect(page.getByText("Thanks — you've reviewed this product.")).toBeVisible();

  // "Sold by" links to the seller's storefront.
  await page.getByRole('link', { name: company }).click();
  await expect(page.getByText(`Showing products from ${company}`)).toBeVisible();
});

test('the review section explains who can review', async ({ page, newApi }) => {
  const seller = await newApi();
  await registerViaApi(seller, 'seller');
  const product = await createProductViaApi(seller);

  await gotoHydrated(page, `/products/${product.id}`);
  await expect(page.getByText("to review a product you've bought")).toBeVisible();

  await registerViaApi(page.request, 'buyer');
  await buyViaApi(page.request, product.id);
  await gotoHydrated(page, `/products/${product.id}`);
  await expect(
    page.getByText('You can review this product once your order of it has been delivered.'),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Write a review' })).toHaveCount(0);
});
