import type { Cart } from './Cart';
import type { CartId } from './CartId';

export interface CartRepository {
  findById(id: CartId): Promise<Cart | null>;
  findByUserId(userId: string): Promise<Cart | null>;
  save(cart: Cart): Promise<void>;
}
