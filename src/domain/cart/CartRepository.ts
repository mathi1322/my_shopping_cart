import type { Cart } from './Cart';
import type { CartId } from './CartId';

export interface CartRepository {
  findById(id: CartId): Promise<Cart | null>;
  findByUserId(userId: string): Promise<Cart | null>;
  /** Like findByUserId, but row-locks the cart until the surrounding UnitOfWork ends. */
  findByUserIdForUpdate(userId: string): Promise<Cart | null>;
  save(cart: Cart): Promise<void>;
}
