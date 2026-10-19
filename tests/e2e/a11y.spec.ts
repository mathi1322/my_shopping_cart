import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { test, expect, createProductViaApi, gotoHydrated, registerViaApi } from './fixtures';

test.skip(({ browserName }) => browserName !== 'chromium', 'one engine is enough for axe');

interface Violation {
  where: string;
  id: string;
  impact: string | null | undefined;
  target: string;
  html: string;
  data: unknown;
}

async function audit(page: Page, where: string): Promise<Violation[]> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  return results.violations.flatMap((violation) =>
    violation.nodes.map((node) => ({
      where,
      id: violation.id,
      impact: violation.impact,
      target: node.target.join(' '),
      html: node.html.slice(0, 160),
      data: node.any[0]?.data,
    })),
  );
}

test('pages and interactive states meet WCAG 2 A/AA', async ({ page, browser, baseURL }) => {
  const violations: Violation[] = [];

  // Seller with a product, logged in on its own page.
  const sellerContext = await browser.newContext({ baseURL });
  const sellerPage = await sellerContext.newPage();
  await registerViaApi(sellerPage.request, 'seller');
  const product = await createProductViaApi(sellerPage.request);
  const soldOut = await createProductViaApi(sellerPage.request, { stockQuantity: 0 });

  // Anonymous pages.
  for (const path of [
    '/',
    `/products/${product.id}`,
    `/products/${soldOut.id}`,
    '/login',
    '/register',
  ]) {
    await gotoHydrated(page, path);
    violations.push(...(await audit(page, path)));
  }

  // Buyer: add-to-cart message, cart, checkout modal, orders, profile, account menu.
  await registerViaApi(page.request, 'buyer');
  await gotoHydrated(page, `/products/${product.id}`);
  await page.getByRole('button', { name: /add to cart/i }).click();
  await expect(page.getByText('Added ✓')).toBeVisible();
  violations.push(...(await audit(page, 'product page after add-to-cart')));

  await gotoHydrated(page, '/cart');
  violations.push(...(await audit(page, '/cart')));
  await page.getByRole('button', { name: /place order/i }).click();
  violations.push(...(await audit(page, 'checkout: delivery details')));
  await page.getByLabel('Delivery address').fill('1 Test Street');
  await page.getByLabel('Phone number').fill('9876543210');
  await page.getByRole('button', { name: 'Continue' }).click();
  violations.push(...(await audit(page, 'checkout: confirm')));
  await page.getByRole('button', { name: /confirm order/i }).click();
  await expect(page).toHaveURL(/\/orders\?placed=1/);
  violations.push(...(await audit(page, '/orders (with an order)')));

  await gotoHydrated(page, '/profile');
  violations.push(...(await audit(page, '/profile')));
  await page.getByRole('button', { name: 'Account menu' }).click();
  violations.push(...(await audit(page, 'account menu open')));

  // Seller pages, now that there is a sale.
  for (const path of ['/sell', '/sell/orders', '/sell/dashboard']) {
    await gotoHydrated(sellerPage, path);
    violations.push(...(await audit(sellerPage, path)));
  }
  await gotoHydrated(sellerPage, '/sell');
  await sellerPage
    .getByRole('listitem')
    .filter({ hasText: product.name })
    .getByRole('button', { name: /edit/i })
    .click();
  violations.push(...(await audit(sellerPage, '/sell (editing a product)')));
  await sellerContext.close();

  if (process.env.A11Y_REPORT) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(process.env.A11Y_REPORT, JSON.stringify(violations, null, 2));
  }
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
});
