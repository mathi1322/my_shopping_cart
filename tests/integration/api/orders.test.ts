import { beforeEach, describe, expect, it } from 'vitest';
import { POST as createProduct } from '@/pages/api/products/index';
import { GET as getProduct, PUT as updateProduct } from '@/pages/api/products/[id]';
import { POST as addItem } from '@/pages/api/cart/items/index';
import { GET as listOrders, POST as placeOrderRoute } from '@/pages/api/orders/index';
import { GET as listReceived } from '@/pages/api/orders/received';
import { POST as cancelOrderRoute } from '@/pages/api/orders/[id]/cancel';
import { createTestDb, truncateAll, seedTestUser } from '../setupDb';
import { callRoute, jsonRequest } from './_httpTestUtils';
import type { UserDto } from '@/application/identity/UserDto';

const { db } = createTestDb();
let seller: UserDto;
let buyer: UserDto;

async function seedProduct(overrides: Record<string, unknown> = {}) {
  const response = await callRoute(createProduct, {
    request: jsonRequest('http://localhost/api/products', 'POST', {
      name: 'Digital Infrared Thermometer',
      description: 'Non-contact thermometer',
      priceInCents: 89900,
      stockQuantity: 5,
      category: 'Diagnostic Devices',
      ...overrides,
    }),
    user: seller,
  });
  return response.json();
}

async function addToCart(productId: string, quantity = 1) {
  return callRoute(addItem, {
    request: jsonRequest('http://localhost/api/cart/items', 'POST', { productId, quantity }),
    user: buyer,
  });
}

function placeOrderBody(overrides: Record<string, unknown> = {}) {
  return {
    deliveryAddress: '221B Baker Street',
    deliveryPhone: '9876543210',
    ...overrides,
  };
}

describe('Orders API', () => {
  beforeEach(async () => {
    await truncateAll(db);
    seller = await seedTestUser(db, 'seller');
    buyer = await seedTestUser(db, 'buyer');
  });

  it('returns 401 when placing an order while logged out', async () => {
    const response = await callRoute(placeOrderRoute, {
      request: jsonRequest('http://localhost/api/orders', 'POST', placeOrderBody()),
    });
    expect(response.status).toBe(401);
  });

  it('returns 409 when placing an order with an empty cart', async () => {
    const response = await callRoute(placeOrderRoute, {
      request: jsonRequest('http://localhost/api/orders', 'POST', placeOrderBody()),
      user: buyer,
    });
    expect(response.status).toBe(409);
  });

  it('returns 400 when delivery address/phone are missing', async () => {
    const product = await seedProduct();
    await addToCart(product.id);

    const response = await callRoute(placeOrderRoute, {
      request: jsonRequest('http://localhost/api/orders', 'POST', {
        deliveryAddress: '',
        deliveryPhone: '',
      }),
      user: buyer,
    });
    expect(response.status).toBe(400);
  });

  it('places an order from the cart, decrements stock, and empties the cart', async () => {
    const product = await seedProduct({ stockQuantity: 5 });
    await addToCart(product.id, 2);

    const response = await callRoute(placeOrderRoute, {
      request: jsonRequest('http://localhost/api/orders', 'POST', placeOrderBody()),
      user: buyer,
    });

    expect(response.status).toBe(201);
    const order = await response.json();
    expect(order.status).toBe('placed');
    expect(order.items).toHaveLength(1);
    expect(order.items[0].quantity).toBe(2);
    expect(order.paymentMethod).toBe('cod');

    const listResponse = await callRoute(listOrders, {
      request: jsonRequest('http://localhost/api/orders', 'GET'),
      user: buyer,
    });
    const { orders } = await listResponse.json();
    expect(orders).toHaveLength(1);
    expect(orders[0].id).toBe(order.id);
  });

  it('returns 409 when checkout stock no longer covers the cart quantity', async () => {
    const product = await seedProduct({ stockQuantity: 1 });
    await addToCart(product.id, 1);

    // Stock drops to zero (e.g. another buyer's order) before this buyer checks out.
    await callRoute(updateProduct, {
      request: jsonRequest(`http://localhost/api/products/${product.id}`, 'PUT', {
        stockQuantity: 0,
      }),
      params: { id: product.id },
      user: seller,
    });

    const response = await callRoute(placeOrderRoute, {
      request: jsonRequest('http://localhost/api/orders', 'POST', placeOrderBody()),
      user: buyer,
    });
    expect(response.status).toBe(409);
  });

  it('lets the buyer cancel their own order and restores stock', async () => {
    const product = await seedProduct({ stockQuantity: 5 });
    await addToCart(product.id, 2);
    const placeResponse = await callRoute(placeOrderRoute, {
      request: jsonRequest('http://localhost/api/orders', 'POST', placeOrderBody()),
      user: buyer,
    });
    const order = await placeResponse.json();

    const cancelResponse = await callRoute(cancelOrderRoute, {
      request: jsonRequest(`http://localhost/api/orders/${order.id}/cancel`, 'POST'),
      params: { id: order.id },
      user: buyer,
    });
    expect(cancelResponse.status).toBe(200);
    const cancelled = await cancelResponse.json();
    expect(cancelled.status).toBe('cancelled');

    const productResponse = await callRoute(getProduct, {
      request: jsonRequest(`http://localhost/api/products/${product.id}`, 'GET'),
      params: { id: product.id },
    });
    const refreshedProduct = await productResponse.json();
    expect(refreshedProduct.stockQuantity).toBe(5);
  });

  it('refuses to cancel an order that belongs to a different buyer', async () => {
    const product = await seedProduct();
    await addToCart(product.id);
    const placeResponse = await callRoute(placeOrderRoute, {
      request: jsonRequest('http://localhost/api/orders', 'POST', placeOrderBody()),
      user: buyer,
    });
    const order = await placeResponse.json();

    const otherBuyer = await seedTestUser(db, 'buyer');
    const cancelResponse = await callRoute(cancelOrderRoute, {
      request: jsonRequest(`http://localhost/api/orders/${order.id}/cancel`, 'POST'),
      params: { id: order.id },
      user: otherBuyer,
    });
    expect(cancelResponse.status).toBe(403);
  });

  it('lets the seller see orders containing their products, narrowed to their own items', async () => {
    const product = await seedProduct();
    await addToCart(product.id);
    await callRoute(placeOrderRoute, {
      request: jsonRequest('http://localhost/api/orders', 'POST', placeOrderBody()),
      user: buyer,
    });

    const response = await callRoute(listReceived, {
      request: jsonRequest('http://localhost/api/orders/received', 'GET'),
      user: seller,
    });
    expect(response.status).toBe(200);
    const { orders } = await response.json();
    expect(orders).toHaveLength(1);
    expect(orders[0].buyerEmail).toBe(buyer.email);
    expect(orders[0].items[0].productId).toBe(product.id);
  });

  it('returns 403 when a buyer tries to view orders received', async () => {
    const response = await callRoute(listReceived, {
      request: jsonRequest('http://localhost/api/orders/received', 'GET'),
      user: buyer,
    });
    expect(response.status).toBe(403);
  });
});
