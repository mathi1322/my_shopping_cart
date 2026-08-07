import type { Product } from './Product';
import type { ProductId } from './ProductId';
import type { VendorId } from './VendorId';

export interface ProductRepository {
  save(product: Product): Promise<void>;
  findById(id: ProductId): Promise<Product | null>;
  findAll(): Promise<Product[]>;
  findByVendorId(vendorId: VendorId): Promise<Product[]>;
  delete(id: ProductId): Promise<void>;
}
