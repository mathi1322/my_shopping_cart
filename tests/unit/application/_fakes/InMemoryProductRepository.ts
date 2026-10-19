import type { Product } from '@/domain/product/Product';
import type { ProductId } from '@/domain/product/ProductId';
import type { VendorId } from '@/domain/product/VendorId';
import type { ProductRepository } from '@/domain/product/ProductRepository';

export class InMemoryProductRepository implements ProductRepository {
  private readonly products = new Map<string, Product>();

  async save(product: Product): Promise<void> {
    this.products.set(product.id.toString(), product);
  }

  async findById(id: ProductId): Promise<Product | null> {
    return this.products.get(id.toString()) ?? null;
  }

  async findByIdForUpdate(id: ProductId): Promise<Product | null> {
    return this.findById(id);
  }

  async findAll(): Promise<Product[]> {
    return [...this.products.values()];
  }

  async findByVendorId(vendorId: VendorId): Promise<Product[]> {
    return [...this.products.values()].filter((product) => product.vendorId.equals(vendorId));
  }

  async delete(id: ProductId): Promise<void> {
    this.products.delete(id.toString());
  }

  async decrementStock(id: ProductId, quantity: number): Promise<boolean> {
    const product = this.products.get(id.toString());
    if (!product || !product.hasStockFor(quantity)) {
      return false;
    }
    product.updateDetails({ stockQuantity: product.stockQuantity - quantity });
    product.pullDomainEvents();
    return true;
  }

  async incrementStock(id: ProductId, quantity: number): Promise<void> {
    const product = this.products.get(id.toString());
    if (product) {
      product.updateDetails({ stockQuantity: product.stockQuantity + quantity });
      product.pullDomainEvents();
    }
  }
}
