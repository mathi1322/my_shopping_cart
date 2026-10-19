import { and, eq, gte, sql } from 'drizzle-orm';
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
    category: row.category,
    features: row.features,
    images: row.images,
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
      category: product.category,
      features: product.features,
      images: product.images,
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
          category: row.category,
          features: row.features,
          images: row.images,
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

  async findByIdForUpdate(id: ProductId): Promise<Product | null> {
    const [row] = await this.db
      .select()
      .from(products)
      .where(eq(products.id, id.toString()))
      .limit(1)
      .for('update');
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

  async decrementStock(id: ProductId, quantity: number): Promise<boolean> {
    // The stock check lives in the WHERE clause so check-and-decrement is a single atomic statement.
    const updated = await this.db
      .update(products)
      .set({ stockQuantity: sql`${products.stockQuantity} - ${quantity}`, updatedAt: new Date() })
      .where(and(eq(products.id, id.toString()), gte(products.stockQuantity, quantity)))
      .returning({ id: products.id });
    return updated.length > 0;
  }

  async incrementStock(id: ProductId, quantity: number): Promise<void> {
    await this.db
      .update(products)
      .set({ stockQuantity: sql`${products.stockQuantity} + ${quantity}`, updatedAt: new Date() })
      .where(eq(products.id, id.toString()));
  }
}
