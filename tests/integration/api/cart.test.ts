import { beforeEach, describe, expect, it } from 'vitest';
import { POST as createProduct } from '@/pages/api/products/index';
import { GET as getCart } from '@/pages/api/cart/index';
import { POST as addItem } from '@/pages/api/cart/items/index';
import { PUT as updateItem, DELETE as removeItem } from '@/pages/api/cart/items/[productId]';
import { createTestDb, truncateAll, seedTestUser } from '../setupDb';
import { callRoute, jsonRequest } from './_httpTestUtils';
import type { UserDto } from '@/application/identity/UserDto';

const { db } = createTestDb();
let seller: UserDto;
let buyer: UserDto;

async function seedProduct(overrides: Record<string, unknown> = {}) {
  const response = await callRoute(createProduct, {
    request: jsonRequest('http://localhost/api/products', 'POST', {
      name: 'Wireless Mouse',
      description: 'A reliable wireless mouse',
      priceInCents: 1999,
      stockQuantity: 5,
      category: 'Diagnostic Devices',
      ...overrides,
    }),
    user: seller,
  });
  return response.json();
}

describe('Cart API', () => {
  beforeEach(async () => {
    await truncateAll(db);
    seller = await seedTestUser(db, 'seller');
    buyer = await seedTestUser(db, 'buyer');
  });

  it('returns 401 when viewing the cart while logged out', async () => {
    const response = await callRoute(getCart, {
      request: jsonRequest('http://localhost/api/cart', 'GET'),
    });
    expect(response.status).toBe(401);
  });

  it('returns 401 when adding an item while logged out', async () => {
    const product = await seedProduct();
    const response = await callRoute(addItem, {
      request: jsonRequest('http://localhost/api/cart/items', 'POST', {
        productId: product.id,
        quantity: 1,
      }),
    });
    expect(response.status).toBe(401);
  });

  it('returns an empty cart on first view', async () => {
    const response = await callRoute(getCart, {
      request: jsonRequest('http://localhost/api/cart', 'GET'),
      user: buyer,
    });
    const body = await response.json();

    expect(body.items).toEqual([]);
    expect(body.totalInCents).toBe(0);
  });

  it('adds an item to the cart (POST /api/cart/items) and returns 201', async () => {
    const product = await seedProduct();

    const response = await callRoute(addItem, {
      request: jsonRequest('http://localhost/api/cart/items', 'POST', {
        productId: product.id,
        quantity: 2,
      }),
      user: buyer,
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].quantity).toBe(2);
    expect(body.totalInCents).toBe(3998);
  });

  it('returns 404 when adding an unknown product to the cart', async () => {
    const response = await callRoute(addItem, {
      request: jsonRequest('http://localhost/api/cart/items', 'POST', {
        productId: 'missing-id',
        quantity: 1,
      }),
      user: buyer,
    });

    expect(response.status).toBe(404);
  });

  it('returns 400 for an invalid quantity', async () => {
    const product = await seedProduct();
    const response = await callRoute(addItem, {
      request: jsonRequest('http://localhost/api/cart/items', 'POST', {
        productId: product.id,
        quantity: 0,
      }),
      user: buyer,
    });

    expect(response.status).toBe(400);
  });

  it('returns 409 when the requested quantity exceeds available stock', async () => {
    const product = await seedProduct({ stockQuantity: 1 });

    const response = await callRoute(addItem, {
      request: jsonRequest('http://localhost/api/cart/items', 'POST', {
        productId: product.id,
        quantity: 2,
      }),
      user: buyer,
    });

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe('CONFLICT');
  });

  it('views the cart after items were added', async () => {
    const product = await seedProduct();

    await callRoute(addItem, {
      request: jsonRequest('http://localhost/api/cart/items', 'POST', {
        productId: product.id,
        quantity: 1,
      }),
      user: buyer,
    });

    const response = await callRoute(getCart, {
      request: jsonRequest('http://localhost/api/cart', 'GET'),
      user: buyer,
    });
    const body = await response.json();

    expect(body.items).toHaveLength(1);
  });

  it('keeps each user’s cart isolated from other users', async () => {
    const product = await seedProduct({ stockQuantity: 10 });
    const otherBuyer = await seedTestUser(db, 'buyer');

    await callRoute(addItem, {
      request: jsonRequest('http://localhost/api/cart/items', 'POST', {
        productId: product.id,
        quantity: 3,
      }),
      user: buyer,
    });

    const otherResponse = await callRoute(getCart, {
      request: jsonRequest('http://localhost/api/cart', 'GET'),
      user: otherBuyer,
    });
    const otherBody = await otherResponse.json();
    expect(otherBody.items).toEqual([]);

    const mineResponse = await callRoute(getCart, {
      request: jsonRequest('http://localhost/api/cart', 'GET'),
      user: buyer,
    });
    const mineBody = await mineResponse.json();
    expect(mineBody.items).toHaveLength(1);
    expect(mineBody.items[0].quantity).toBe(3);
  });

  it('updates an item quantity (PUT /api/cart/items/:productId)', async () => {
    const product = await seedProduct({ stockQuantity: 10 });

    await callRoute(addItem, {
      request: jsonRequest('http://localhost/api/cart/items', 'POST', {
        productId: product.id,
        quantity: 1,
      }),
      user: buyer,
    });

    const response = await callRoute(updateItem, {
      request: jsonRequest(`http://localhost/api/cart/items/${product.id}`, 'PUT', { quantity: 4 }),
      params: { productId: product.id },
      user: buyer,
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items[0].quantity).toBe(4);
  });

  it('returns 409 when updating to a quantity beyond available stock', async () => {
    const product = await seedProduct({ stockQuantity: 3 });

    await callRoute(addItem, {
      request: jsonRequest('http://localhost/api/cart/items', 'POST', {
        productId: product.id,
        quantity: 1,
      }),
      user: buyer,
    });

    const response = await callRoute(updateItem, {
      request: jsonRequest(`http://localhost/api/cart/items/${product.id}`, 'PUT', {
        quantity: 10,
      }),
      params: { productId: product.id },
      user: buyer,
    });

    expect(response.status).toBe(409);
  });

  it('returns 401 when updating an item while logged out', async () => {
    const response = await callRoute(updateItem, {
      request: jsonRequest('http://localhost/api/cart/items/some-id', 'PUT', { quantity: 1 }),
      params: { productId: 'some-id' },
    });

    expect(response.status).toBe(401);
  });

  it('removes an item from the cart (DELETE /api/cart/items/:productId)', async () => {
    const product = await seedProduct();

    await callRoute(addItem, {
      request: jsonRequest('http://localhost/api/cart/items', 'POST', {
        productId: product.id,
        quantity: 1,
      }),
      user: buyer,
    });

    const response = await callRoute(removeItem, {
      request: jsonRequest(`http://localhost/api/cart/items/${product.id}`, 'DELETE'),
      params: { productId: product.id },
      user: buyer,
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toEqual([]);
  });

  it('returns 404 when removing an item that is not in the cart', async () => {
    const product = await seedProduct();

    await callRoute(getCart, {
      request: jsonRequest('http://localhost/api/cart', 'GET'),
      user: buyer,
    });

    const response = await callRoute(removeItem, {
      request: jsonRequest(`http://localhost/api/cart/items/${product.id}`, 'DELETE'),
      params: { productId: product.id },
      user: buyer,
    });

    expect(response.status).toBe(404);
  });

  it("handles a new buyer's first cart requests arriving at the same time", async () => {
    // Right after login the cart badge (GET /api/cart) and an add-to-cart can race to
    // create the buyer's cart; every request must succeed and they must share one cart.
    const product = await seedProduct({ stockQuantity: 100 });

    for (let round = 0; round < 5; round += 1) {
      const newBuyer = await seedTestUser(db, 'buyer');
      const responses = await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          i % 2 === 0
            ? callRoute(getCart, {
                request: jsonRequest('http://localhost/api/cart', 'GET'),
                user: newBuyer,
              })
            : callRoute(addItem, {
                request: jsonRequest('http://localhost/api/cart/items', 'POST', {
                  productId: product.id,
                  quantity: 1,
                }),
                user: newBuyer,
              }),
        ),
      );

      expect(responses.map((r) => r.status).filter((status) => status >= 400)).toEqual([]);
      const cartIds = new Set(
        await Promise.all(responses.map(async (r) => (await r.json()).id as string)),
      );
      expect(cartIds.size).toBe(1);

      // No add was lost to a concurrent overwrite: 5 adds of 1 unit each.
      const finalCart = await (
        await callRoute(getCart, {
          request: jsonRequest('http://localhost/api/cart', 'GET'),
          user: newBuyer,
        })
      ).json();
      expect(finalCart.items[0].quantity).toBe(5);
    }
  });
});
