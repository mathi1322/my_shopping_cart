import { eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { carts, cartItems } from '../db/schema';
import { Cart } from '../../domain/cart/Cart';
import { CartId } from '../../domain/cart/CartId';
import { CartItem } from '../../domain/cart/CartItem';
import { Quantity } from '../../domain/cart/Quantity';
import { ProductId } from '../../domain/product/ProductId';
import { VendorId } from '../../domain/product/VendorId';
import { Money } from '../../domain/shared/Money';
import type { CartRepository } from '../../domain/cart/CartRepository';

type CartItemRow = typeof cartItems.$inferSelect;

function itemToDomain(row: CartItemRow): CartItem {
  return new CartItem({
    productId: ProductId.fromString(row.productId),
    productName: row.productName,
    vendorId: VendorId.fromString(row.vendorId),
    unitPrice: Money.fromCents(row.unitPriceInCents, row.currency),
    quantity: Quantity.of(row.quantity),
  });
}

export class DrizzleCartRepository implements CartRepository {
  constructor(private readonly db: Database) {}

  async findById(id: CartId): Promise<Cart | null> {
    const [cartRow] = await this.db
      .select()
      .from(carts)
      .where(eq(carts.id, id.toString()))
      .limit(1);
    if (!cartRow) {
      return null;
    }

    const itemRows = await this.db
      .select()
      .from(cartItems)
      .where(eq(cartItems.cartId, id.toString()));

    return Cart.reconstitute({
      id: CartId.fromString(cartRow.id),
      items: itemRows.map(itemToDomain),
      createdAt: cartRow.createdAt,
      updatedAt: cartRow.updatedAt,
    });
  }

  async save(cart: Cart): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx
        .insert(carts)
        .values({
          id: cart.id.toString(),
          createdAt: cart.createdAt,
          updatedAt: cart.updatedAt,
        })
        .onConflictDoUpdate({
          target: carts.id,
          set: { updatedAt: cart.updatedAt },
        });

      await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id.toString()));

      if (cart.items.length > 0) {
        await tx.insert(cartItems).values(
          cart.items.map((item) => ({
            cartId: cart.id.toString(),
            productId: item.productId.toString(),
            productName: item.productName,
            vendorId: item.vendorId.toString(),
            unitPriceInCents: item.unitPrice.cents,
            currency: item.unitPrice.currencyCode,
            quantity: item.quantity.value,
          })),
        );
      }
    });
  }
}
