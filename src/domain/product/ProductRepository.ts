import type { Product } from './Product';
import type { ProductId } from './ProductId';
import type { VendorId } from './VendorId';
import type { Page, PageRequest } from '../shared/Pagination';

export interface ProductSearchCriteria {
  vendorId?: VendorId;
  /** Case-insensitive match against name or description. */
  text?: string;
  categories?: readonly string[];
  minPriceCents?: number;
  maxPriceCents?: number;
  inStockOnly?: boolean;
}

export interface ProductRepository {
  save(product: Product): Promise<void>;
  findById(id: ProductId): Promise<Product | null>;
  /** Like findById, but row-locks the product until the surrounding UnitOfWork ends. */
  findByIdForUpdate(id: ProductId): Promise<Product | null>;
  findAll(): Promise<Product[]>;
  findByVendorId(vendorId: VendorId): Promise<Product[]>;
  /** Matching products, newest first. */
  search(criteria: ProductSearchCriteria, page: PageRequest): Promise<Page<Product>>;
  /** Distinct categories that have at least one product (optionally for one vendor). */
  categoriesInUse(vendorId?: VendorId): Promise<string[]>;
  delete(id: ProductId): Promise<void>;
  /** Atomically takes `quantity` units out of stock; returns false (and changes nothing) if there aren't enough. */
  decrementStock(id: ProductId, quantity: number): Promise<boolean>;
  /** Atomically puts `quantity` units back into stock; a no-op if the product no longer exists. */
  incrementStock(id: ProductId, quantity: number): Promise<void>;
}
