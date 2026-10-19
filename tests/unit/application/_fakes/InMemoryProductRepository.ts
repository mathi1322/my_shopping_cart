import type { Product } from '@/domain/product/Product';
import type { ProductId } from '@/domain/product/ProductId';
import type { VendorId } from '@/domain/product/VendorId';
import type { ProductRepository, ProductSearchCriteria } from '@/domain/product/ProductRepository';
import type { Page, PageRequest } from '@/domain/shared/Pagination';

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

  async search(criteria: ProductSearchCriteria, page: PageRequest): Promise<Page<Product>> {
    const text = criteria.text?.trim().toLowerCase();
    const matches = [...this.products.values()]
      .filter((p) => !criteria.vendorId || p.vendorId.equals(criteria.vendorId))
      .filter((p) => !text || `${p.name} ${p.description}`.toLowerCase().includes(text))
      .filter((p) => !criteria.categories?.length || criteria.categories.includes(p.category))
      .filter(
        (p) => criteria.minPriceCents === undefined || p.price.cents >= criteria.minPriceCents,
      )
      .filter(
        (p) => criteria.maxPriceCents === undefined || p.price.cents <= criteria.maxPriceCents,
      )
      .filter((p) => !criteria.inStockOnly || p.stockQuantity > 0)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return { items: matches.slice(page.offset, page.offset + page.limit), total: matches.length };
  }

  async categoriesInUse(vendorId?: VendorId): Promise<string[]> {
    const products = [...this.products.values()].filter(
      (p) => !vendorId || p.vendorId.equals(vendorId),
    );
    return [...new Set(products.map((p) => p.category))].sort();
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
