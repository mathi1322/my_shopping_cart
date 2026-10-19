import { beforeEach, describe, expect, it } from 'vitest';
import { GET as listProducts, POST as createProduct } from '@/pages/api/products/index';
import { GET as getReviews, POST as postReview } from '@/pages/api/products/[id]/reviews';
import { POST as addItem } from '@/pages/api/cart/items/index';
import { GET as listOrders, POST as placeOrderRoute } from '@/pages/api/orders/index';
import { GET as listReceived } from '@/pages/api/orders/received';
import { POST as cancelOrderRoute } from '@/pages/api/orders/[id]/cancel';
import { POST as fulfillmentRoute } from '@/pages/api/orders/[id]/fulfillment';
import { createTestDb, truncateAll, seedTestUser } from '../setupDb';
import { callRoute, jsonRequest } from './_httpTestUtils';
import type { UserDto } from '@/application/identity/UserDto';

const { db } = createTestDb();
let seller: UserDto;
let otherSeller: UserDto;
let buyer: UserDto;

async function seedProduct(owner: UserDto = seller, overrides: Record<string, unknown> = {}) {
  const response = await callRoute(createProduct, {
    request: jsonRequest('http://localhost/api/products', 'POST', {
      name: 'Digital Thermometer',
      description: 'Non-contact',
      priceInCents: 49_900,
      stockQuantity: 50,
      category: 'Diagnostic Devices',
      ...overrides,
    }),
    user: owner,
  });
  expect(response.status).toBe(201);
  return response.json();
}

async function buy(productId: string, user: UserDto = buyer) {
  await callRoute(addItem, {
    request: jsonRequest('http://localhost/api/cart/items', 'POST', { productId, quantity: 1 }),
    user,
  });
  const response = await callRoute(placeOrderRoute, {
    request: jsonRequest('http://localhost/api/orders', 'POST', {
      deliveryAddress: '1 Test Street',
      deliveryPhone: '9876543210',
    }),
    user,
  });
  expect(response.status).toBe(201);
  return response.json();
}

function advance(orderId: string, status: string, user: UserDto = seller) {
  return callRoute(fulfillmentRoute, {
    request: jsonRequest(`http://localhost/api/orders/${orderId}/fulfillment`, 'POST', { status }),
    params: { id: orderId },
    user,
  });
}

function review(productId: string, body: Record<string, unknown>, user: UserDto = buyer) {
  return callRoute(postReview, {
    request: jsonRequest(`http://localhost/api/products/${productId}/reviews`, 'POST', body),
    params: { id: productId },
    user,
  });
}

describe('Order fulfillment and reviews API', () => {
  beforeEach(async () => {
    await truncateAll(db);
    seller = await seedTestUser(db, 'seller');
    otherSeller = await seedTestUser(db, 'seller');
    buyer = await seedTestUser(db, 'buyer');
  });

  it('lets the seller ship, then deliver, and the buyer sees each step', async () => {
    const product = await seedProduct();
    const order = await buy(product.id);

    const shipped = await advance(order.id, 'shipped');
    expect(shipped.status).toBe(200);
    expect((await shipped.json()).status).toBe('shipped');

    const received = await (
      await callRoute(listReceived, {
        request: jsonRequest('http://localhost/api/orders/received', 'GET'),
        user: seller,
      })
    ).json();
    expect(received).toMatchObject({ total: 1, awaitingShipmentCount: 0, page: 1 });
    expect(received.orders[0].status).toBe('shipped');

    expect((await advance(order.id, 'delivered')).status).toBe(200);
    const buyerView = await (
      await callRoute(listOrders, {
        request: jsonRequest('http://localhost/api/orders', 'GET'),
        user: buyer,
      })
    ).json();
    expect(buyerView.orders[0].status).toBe('delivered');
    expect(buyerView.orders[0].items[0].fulfillmentStatus).toBe('delivered');
  });

  it('rejects invalid fulfillment updates', async () => {
    const product = await seedProduct();
    const order = await buy(product.id);

    expect((await advance(order.id, 'delivered')).status).toBe(409); // must ship first
    expect((await advance(order.id, 'shipped', otherSeller)).status).toBe(403); // not their items
    expect((await advance(order.id, 'shipped', buyer)).status).toBe(403); // buyers can't
    expect((await advance(order.id, 'refunded')).status).toBe(400); // not a status
    expect((await advance('no-such-order', 'shipped')).status).toBe(404);
  });

  it('stops the buyer cancelling after the order has shipped', async () => {
    const product = await seedProduct();
    const order = await buy(product.id);
    await advance(order.id, 'shipped');

    const cancel = await callRoute(cancelOrderRoute, {
      request: jsonRequest(`http://localhost/api/orders/${order.id}/cancel`, 'POST'),
      params: { id: order.id },
      user: buyer,
    });
    expect(cancel.status).toBe(409);
  });

  it('only accepts a review after delivery, once per buyer', async () => {
    const product = await seedProduct();
    const order = await buy(product.id);

    expect((await review(product.id, { rating: 5 })).status).toBe(403);
    await advance(order.id, 'shipped');
    expect((await review(product.id, { rating: 5 })).status).toBe(403);
    await advance(order.id, 'delivered');

    expect((await review(product.id, { rating: 9 })).status).toBe(400);
    expect((await review(product.id, { rating: 5 }, seller)).status).toBe(403);

    const created = await review(product.id, { rating: 4, comment: 'Accurate readings' });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({ rating: 4, verifiedPurchase: true });
    expect((await review(product.id, { rating: 1 })).status).toBe(409);

    const summary = await (
      await callRoute(getReviews, {
        request: jsonRequest(`http://localhost/api/products/${product.id}/reviews`, 'GET'),
        params: { id: product.id },
        user: buyer,
      })
    ).json();
    expect(summary).toMatchObject({ count: 1, averageRating: 4, eligibility: 'already-reviewed' });
    expect(summary.reviews[0].comment).toBe('Accurate readings');
  });

  it('keeps one review when the same buyer submits twice at once', async () => {
    const product = await seedProduct();
    const order = await buy(product.id);
    await advance(order.id, 'shipped');
    await advance(order.id, 'delivered');

    const statuses = (
      await Promise.all([review(product.id, { rating: 5 }), review(product.id, { rating: 3 })])
    ).map((r) => r.status);
    expect(statuses.sort()).toEqual([201, 409]);
  });
});

describe('Products API paging and seller names', () => {
  beforeEach(async () => {
    await truncateAll(db);
    seller = await seedTestUser(db, 'seller');
  });

  it('pages results and reports totals', async () => {
    for (let i = 0; i < 5; i += 1) {
      await seedProduct(seller, { name: `Product ${i}` });
    }
    const response = await callRoute(listProducts, {
      request: jsonRequest('http://localhost/api/products?page=2&pageSize=2', 'GET'),
    });
    const body = await response.json();
    expect(body).toMatchObject({ total: 5, page: 2, pageSize: 2, totalPages: 3 });
    expect(body.products).toHaveLength(2);
    expect(body.products[0].vendorName).toBe('MediKart seller');
    expect(body.categories).toEqual(['Diagnostic Devices']);

    const invalid = await callRoute(listProducts, {
      request: jsonRequest('http://localhost/api/products?page=abc', 'GET'),
    });
    expect(invalid.status).toBe(400);
  });

  it('searches by text and category', async () => {
    await seedProduct(seller, { name: 'Pulse Oximeter' });
    await seedProduct(seller, { name: 'N95 Masks', category: 'PPE & Masks' });

    const byText = await (
      await callRoute(listProducts, {
        request: jsonRequest('http://localhost/api/products?q=oxi', 'GET'),
      })
    ).json();
    expect(byText.products.map((p: { name: string }) => p.name)).toEqual(['Pulse Oximeter']);

    const byCategory = await (
      await callRoute(listProducts, {
        request: jsonRequest(
          `http://localhost/api/products?category=${encodeURIComponent('PPE & Masks')}`,
          'GET',
        ),
      })
    ).json();
    expect(byCategory.total).toBe(1);
  });
});
