import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';

export const PASSWORD = 'password123';

let counter = 0;
export function uniqueSuffix(): string {
  counter += 1;
  return `${Date.now().toString(36)}${process.pid}${counter}${Math.random().toString(36).slice(2, 6)}`;
}

function octet(): number {
  return Math.floor(Math.random() * 254) + 1;
}

/**
 * Every test acts as its own client IP (localhost is a trusted host, so Astro
 * honours X-Forwarded-For). Otherwise parallel tests would all share the
 * per-client login/register rate limits.
 */
export function randomIp(): string {
  return `10.${octet()}.${octet()}.${octet()}`;
}

export interface Account {
  email: string;
  password: string;
  id: string;
}

export async function registerViaApi(
  request: APIRequestContext,
  role: 'buyer' | 'seller',
): Promise<Account> {
  const email = `${role}-${uniqueSuffix()}@e2e.test`;
  const response = await request.post('/api/auth/register', {
    data: { email, password: PASSWORD, role },
  });
  expect(response.status(), await response.text()).toBe(201);
  const body = await response.json();
  return { email, password: PASSWORD, id: body.id };
}

export interface CreatedProduct {
  id: string;
  name: string;
  priceInCents: number;
  stockQuantity: number;
}

export async function createProductViaApi(
  seller: APIRequestContext,
  overrides: Partial<{ name: string; priceInCents: number; stockQuantity: number }> = {},
): Promise<CreatedProduct> {
  const response = await seller.post('/api/products', {
    data: {
      name: `E2E Thermometer ${uniqueSuffix()}`,
      description: 'Created by the e2e suite',
      priceInCents: 49_900,
      stockQuantity: 5,
      category: 'Diagnostic Devices',
      ...overrides,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  return response.json();
}

export async function stockOf(request: APIRequestContext, productId: string): Promise<number> {
  const response = await request.get(`/api/products/${productId}`);
  return (await response.json()).stockQuantity;
}

/** Islands are all client:load; clicking before hydration would submit native forms instead. */
export async function gotoHydrated(page: Page, path: string): Promise<void> {
  await page.goto(path);
  await page.waitForFunction(() => document.querySelectorAll('astro-island[ssr]').length === 0);
}

/** Whole rupees, as the seller dashboard shows them. */
export function inrWhole(cents: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** Formats cents exactly like the cart and orders UI (en-IN, INR). */
export function inr(cents: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(cents / 100);
}

export const test = base.extend<{
  newApi: () => Promise<APIRequestContext>;
  pageErrors: Error[];
}>({
  // Playwright requires the (empty) destructured fixtures argument.
  // eslint-disable-next-line no-empty-pattern
  extraHTTPHeaders: async ({}, use) => {
    await use({ 'X-Forwarded-For': randomIp() });
  },

  /** A separate API client with its own cookie jar and client IP (e.g. the seller in a buyer test). */
  newApi: async ({ playwright, baseURL }, use) => {
    const contexts: APIRequestContext[] = [];
    await use(async () => {
      const context = await playwright.request.newContext({
        baseURL,
        extraHTTPHeaders: { 'X-Forwarded-For': randomIp() },
      });
      contexts.push(context);
      return context;
    });
    await Promise.all(contexts.map((context) => context.dispose()));
  },

  /** Fails any test whose pages throw an uncaught exception. */
  pageErrors: [
    async ({ page }, use) => {
      const errors: Error[] = [];
      page.on('pageerror', (error) => errors.push(error));
      await use(errors);
      expect(errors, 'uncaught page errors').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
