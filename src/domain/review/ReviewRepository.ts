import type { ProductId } from '../product/ProductId';
import type { Review } from './Review';

export interface ReviewRepository {
  findByProductId(productId: ProductId): Promise<Review[]>;
}
