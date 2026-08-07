import { beforeEach, describe, expect, it } from 'vitest';
import { GET as listProducts, POST as createProduct } from '@/pages/api/products/index';
import {
  GET as getProduct,
  PUT as updateProduct,
  DELETE as deleteProduct,
} from '@/pages/api/products/[id]';
import { createTestDb, truncateAll, seedTestUser } from '../setupDb';
import { callRoute, jsonRequest } from './_httpTestUtils';
import type { UserDto } from '@/application/identity/UserDto';

const { db } = createTestDb();

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Wireless Mouse',
    description: 'A reliable wireless mouse',
    priceInCents: 1999,
    stockQuantity: 10,
    ...overrides,
  };
}

async function createTestProduct(seller: UserDto, overrides: Record<string, unknown> = {}) {
  const response = await callRoute(createProduct, {
    request: jsonRequest('http://localhost/api/products', 'POST', validPayload(overrides)),
    user: seller,
  });
  return response.json();
}

describe('Products API', () => {
  let seller: UserDto;
  let otherSeller: UserDto;
  let buyer: UserDto;

  beforeEach(async () => {
    await truncateAll(db);
    seller = await seedTestUser(db, 'seller');
    otherSeller = await seedTestUser(db, 'seller');
    buyer = await seedTestUser(db, 'buyer');
  });

  it('creates a product owned by the authenticated seller (POST /api/products) and returns 201', async () => {
    const response = await callRoute(createProduct, {
      request: jsonRequest('http://localhost/api/products', 'POST', validPayload()),
      user: seller,
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.name).toBe('Wireless Mouse');
    expect(body.vendorId).toBe(seller.id);
  });

  it('returns 401 when creating a product without being logged in', async () => {
    const response = await callRoute(createProduct, {
      request: jsonRequest('http://localhost/api/products', 'POST', validPayload()),
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 403 when a buyer tries to create a product', async () => {
    const response = await callRoute(createProduct, {
      request: jsonRequest('http://localhost/api/products', 'POST', validPayload()),
      user: buyer,
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('rejects an invalid payload with 400 and a validation error body', async () => {
    const response = await callRoute(createProduct, {
      request: jsonRequest('http://localhost/api/products', 'POST', { name: '' }),
      user: seller,
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects malformed JSON with 400', async () => {
    const response = await callRoute(createProduct, {
      request: new Request('http://localhost/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{not json',
      }),
      user: seller,
    });

    expect(response.status).toBe(400);
  });

  it('lists all products (GET /api/products)', async () => {
    await createTestProduct(seller, { name: 'A' });
    await createTestProduct(otherSeller, { name: 'B' });

    const response = await callRoute(listProducts, {
      request: jsonRequest('http://localhost/api/products', 'GET'),
    });
    const body = await response.json();

    expect(body.products).toHaveLength(2);
  });

  it('filters products by vendorId (GET /api/products?vendorId=...)', async () => {
    await createTestProduct(seller, { name: 'Mine' });
    await createTestProduct(otherSeller, { name: 'Theirs' });

    const response = await callRoute(listProducts, {
      request: jsonRequest(`http://localhost/api/products?vendorId=${seller.id}`, 'GET'),
    });
    const body = await response.json();

    expect(body.products).toHaveLength(1);
    expect(body.products[0].name).toBe('Mine');
  });

  it('fetches a single product by id (GET /api/products/:id)', async () => {
    const created = await createTestProduct(seller);

    const response = await callRoute(getProduct, {
      request: jsonRequest(`http://localhost/api/products/${created.id}`, 'GET'),
      params: { id: created.id },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.id).toBe(created.id);
  });

  it('returns 404 for an unknown product id', async () => {
    const response = await callRoute(getProduct, {
      request: jsonRequest('http://localhost/api/products/missing-id', 'GET'),
      params: { id: 'missing-id' },
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('updates a product owned by the authenticated seller (PUT /api/products/:id)', async () => {
    const created = await createTestProduct(seller);

    const response = await callRoute(updateProduct, {
      request: jsonRequest(`http://localhost/api/products/${created.id}`, 'PUT', {
        priceInCents: 2500,
        stockQuantity: 3,
      }),
      params: { id: created.id },
      user: seller,
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.priceInCents).toBe(2500);
    expect(body.stockQuantity).toBe(3);
  });

  it('returns 401 when updating a product without being logged in', async () => {
    const created = await createTestProduct(seller);

    const response = await callRoute(updateProduct, {
      request: jsonRequest(`http://localhost/api/products/${created.id}`, 'PUT', {
        priceInCents: 1,
      }),
      params: { id: created.id },
    });

    expect(response.status).toBe(401);
  });

  it('returns 403 when a different seller tries to update the product', async () => {
    const created = await createTestProduct(seller);

    const response = await callRoute(updateProduct, {
      request: jsonRequest(`http://localhost/api/products/${created.id}`, 'PUT', {
        priceInCents: 1,
      }),
      params: { id: created.id },
      user: otherSeller,
    });

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('rejects an empty update payload with 400', async () => {
    const created = await createTestProduct(seller);

    const response = await callRoute(updateProduct, {
      request: jsonRequest(`http://localhost/api/products/${created.id}`, 'PUT', {}),
      params: { id: created.id },
      user: seller,
    });

    expect(response.status).toBe(400);
  });

  it('returns 404 when updating an unknown product', async () => {
    const response = await callRoute(updateProduct, {
      request: jsonRequest('http://localhost/api/products/missing-id', 'PUT', {
        priceInCents: 100,
      }),
      params: { id: 'missing-id' },
      user: seller,
    });

    expect(response.status).toBe(404);
  });

  it('deletes a product owned by the authenticated seller (DELETE /api/products/:id) and returns 204', async () => {
    const created = await createTestProduct(seller);

    const response = await callRoute(deleteProduct, {
      request: jsonRequest(`http://localhost/api/products/${created.id}`, 'DELETE'),
      params: { id: created.id },
      user: seller,
    });
    expect(response.status).toBe(204);

    const getResponse = await callRoute(getProduct, {
      request: jsonRequest(`http://localhost/api/products/${created.id}`, 'GET'),
      params: { id: created.id },
    });
    expect(getResponse.status).toBe(404);
  });

  it('returns 403 when a different seller tries to delete the product', async () => {
    const created = await createTestProduct(seller);

    const response = await callRoute(deleteProduct, {
      request: jsonRequest(`http://localhost/api/products/${created.id}`, 'DELETE'),
      params: { id: created.id },
      user: otherSeller,
    });

    expect(response.status).toBe(403);
  });

  it('returns 404 when deleting an unknown product', async () => {
    const response = await callRoute(deleteProduct, {
      request: jsonRequest('http://localhost/api/products/missing-id', 'DELETE'),
      params: { id: 'missing-id' },
      user: seller,
    });

    expect(response.status).toBe(404);
  });
});
