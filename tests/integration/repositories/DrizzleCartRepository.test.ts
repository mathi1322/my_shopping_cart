import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { DrizzleCartRepository } from '@/infrastructure/repositories/DrizzleCartRepository';
import { DrizzleProductRepository } from '@/infrastructure/repositories/DrizzleProductRepository';
import { Cart } from '@/domain/cart/Cart';
import { CartId } from '@/domain/cart/CartId';
import { Product } from '@/domain/product/Product';
import { Quantity } from '@/domain/cart/Quantity';
import { VendorId } from '@/domain/product/VendorId';
import { Money } from '@/domain/shared/Money';
import { createTestDb, truncateAll, seedTestUser } from '../setupDb';

const { db, client } = createTestDb();
const cartRepository = new DrizzleCartRepository(db);
const productRepository = new DrizzleProductRepository(db);
let buyerId: string;

async function seedProduct() {
  const seller = await seedTestUser(db, 'seller');
  const product = Product.create({
    vendorId: VendorId.fromString(seller.id),
    name: 'Wireless Mouse',
    description: 'A reliable wireless mouse',
    price: Money.fromCents(1999),
    stockQuantity: 10,
  });
  await productRepository.save(product);
  return product;
}

describe('DrizzleCartRepository', () => {
  beforeEach(async () => {
    await truncateAll(db);
    buyerId = (await seedTestUser(db, 'buyer')).id;
  });

  afterAll(async () => {
    await client.end();
  });

  it('returns null for an unknown cart id', async () => {
    expect(await cartRepository.findById(CartId.create())).toBeNull();
  });

  it('returns null for a user with no cart', async () => {
    expect(await cartRepository.findByUserId(buyerId)).toBeNull();
  });

  it('saves an empty cart and retrieves it by id and by user', async () => {
    const cart = Cart.create(buyerId);
    await cartRepository.save(cart);

    const foundById = await cartRepository.findById(cart.id);
    expect(foundById).not.toBeNull();
    expect(foundById?.isEmpty).toBe(true);
    expect(foundById?.userId).toBe(buyerId);

    const foundByUser = await cartRepository.findByUserId(buyerId);
    expect(foundByUser?.id.equals(cart.id)).toBe(true);
  });

  it('persists cart items and reconstructs totals on read', async () => {
    const product = await seedProduct();
    const cart = Cart.create(buyerId);
    cart.addItem({
      productId: product.id,
      productName: product.name,
      vendorId: product.vendorId,
      unitPrice: product.price,
      quantity: Quantity.of(2),
    });
    await cartRepository.save(cart);

    const found = await cartRepository.findById(cart.id);

    expect(found?.items).toHaveLength(1);
    expect(found?.total.cents).toBe(3998);
    expect(found?.findItem(product.id)?.productName).toBe('Wireless Mouse');
  });

  it('overwrites the item set on subsequent saves (remove reflected)', async () => {
    const product = await seedProduct();
    const cart = Cart.create(buyerId);
    cart.addItem({
      productId: product.id,
      productName: product.name,
      vendorId: product.vendorId,
      unitPrice: product.price,
      quantity: Quantity.of(1),
    });
    await cartRepository.save(cart);

    cart.removeItem(product.id);
    await cartRepository.save(cart);

    const found = await cartRepository.findById(cart.id);
    expect(found?.isEmpty).toBe(true);
  });
});
