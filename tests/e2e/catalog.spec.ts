import {
  test,
  expect,
  createProductViaApi,
  registerViaApi,
  setCompanyName,
  uniqueSuffix,
} from './fixtures';

test('the catalog pages through a seller’s products, 12 at a time', async ({ page, newApi }) => {
  const seller = await newApi();
  const { id: sellerId } = await registerViaApi(seller, 'seller');
  const company = `Paging Pharmacy ${uniqueSuffix()}`;
  await setCompanyName(seller, company);
  const prefix = `Paged ${uniqueSuffix()}`;
  for (let i = 1; i <= 14; i += 1) {
    await createProductViaApi(seller, { name: `${prefix} #${String(i).padStart(2, '0')}` });
  }

  await page.goto(`/?vendorId=${sellerId}`);
  await expect(page.getByText(`Showing products from ${company}`)).toBeVisible();
  await expect(page.locator('article')).toHaveCount(12);
  await expect(page.getByText('Showing 1–12 of 14 products')).toBeVisible();
  // Newest first.
  await expect(page.locator('article h2').first()).toHaveText(`${prefix} #14`);
  await expect(
    page.getByRole('navigation', { name: 'Pagination' }).locator('[aria-current="page"]'),
  ).toHaveText('1');

  await page.getByRole('link', { name: 'Next →' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('article')).toHaveCount(2);
  await expect(page.getByText('Showing 13–14 of 14 products')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Next →' })).toHaveCount(0);

  await page.getByRole('link', { name: '← Previous' }).click();
  await expect(page.locator('article')).toHaveCount(12);

  // A page past the end goes to the last page rather than showing nothing.
  await page.goto(`/?vendorId=${sellerId}&page=99`);
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator('article')).toHaveCount(2);

  // Applying a filter starts again from page 1 and keeps the storefront.
  await page.getByLabel('In stock only').check();
  await page.getByRole('button', { name: 'Apply Filters' }).click();
  await expect(page).not.toHaveURL(/page=/);
  await expect(page).toHaveURL(new RegExp(`vendorId=${sellerId}`));
  await expect(page.locator('article')).toHaveCount(12);
});

test('search narrows results and shows the match count', async ({ page, newApi }) => {
  const seller = await newApi();
  await registerViaApi(seller, 'seller');
  const unique = `Zylophone${uniqueSuffix()}`;
  await createProductViaApi(seller, { name: `${unique} Oximeter` });

  await page.goto(`/?q=${encodeURIComponent(unique)}`);
  await expect(page.getByText(/1 result for/)).toBeVisible();
  await expect(page.locator('article')).toHaveCount(1);
  await expect(page.getByText('Sold by MediKart seller')).toBeVisible();
});

test('pages send a strict Content-Security-Policy', async ({ request, browserName }) => {
  test.skip(browserName !== 'chromium', 'HTTP-level check');
  const page = await request.get('/');
  const csp = page.headers()['content-security-policy'];
  expect(csp).toContain("default-src 'self'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toMatch(/script-src 'self'( 'sha256-[^']+')+;/);
  expect(csp).not.toContain('unsafe-inline');
  expect(csp).not.toContain('unsafe-eval');

  const api = await request.get('/api/products');
  expect(api.headers()['content-security-policy']).toBe(
    "default-src 'none'; frame-ancestors 'none'",
  );
});
