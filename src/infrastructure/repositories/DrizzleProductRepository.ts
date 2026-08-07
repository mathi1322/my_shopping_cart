import { eq } from 'drizzle-orm';
import type { Database } from '../db/client';
import { products } from '../db/schema';
import { Product } from '../../domain/product/Product';
import { ProductId } from '../../domain/product/ProductId';
import { VendorId } from '../../domain/product/VendorId';
import { Money } from '../../domain/shared/Money';
import type { ProductRepository } from '../../domain/product/ProductRepository';

type ProductRow = typeof products.$inferSelect;

function toDomain(row: ProductRow): Product {
  return Product.reconstitute({
    id: ProductId.fromString(row.id),
    vendorId: VendorId.fromString(row.vendorId),
    name: row.name,
    description: row.description,
    price: Money.fromCents(row.priceInCents, row.currency),
    stockQuantity: row.stockQuantity,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

export class DrizzleProductRepository implements ProductRepository {
  constructor(private readonly db: Database) {}

  async save(product: Product): Promise<void> {
    const row = {
      id: product.id.toString(),
      vendorId: product.vendorId.toString(),
      name: product.name,
      description: product.description,
      priceInCents: product.price.cents,
      currency: product.price.currencyCode,
      stockQuantity: product.stockQuantity,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    };

    await this.db
      .insert(products)
      .values(row)
      .onConflictDoUpdate({
        target: products.id,
        set: {
          vendorId: row.vendorId,
          name: row.name,
          description: row.description,
          priceInCents: row.priceInCents,
          currency: row.currency,
          stockQuantity: row.stockQuantity,
          updatedAt: row.updatedAt,
        },
      });
  }

  async findById(id: ProductId): Promise<Product | null> {
    const [row] = await this.db
      .select()
      .from(products)
      .where(eq(products.id, id.toString()))
      .limit(1);
    return row ? toDomain(row) : null;
  }

  async findAll(): Promise<Product[]> {
    const rows = await this.db.select().from(products).orderBy(products.createdAt);
    return rows.map(toDomain);
  }

  async findByVendorId(vendorId: VendorId): Promise<Product[]> {
    const rows = await this.db
      .select()
      .from(products)
      .where(eq(products.vendorId, vendorId.toString()))
      .orderBy(products.createdAt);
    return rows.map(toDomain);
  }

  async delete(id: ProductId): Promise<void> {
    await this.db.delete(products).where(eq(products.id, id.toString()));
  }
}
