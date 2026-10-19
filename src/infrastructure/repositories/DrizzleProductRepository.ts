import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import type { Database } from '../db/client';
import { products } from '../db/schema';
import { Product } from '../../domain/product/Product';
import { ProductId } from '../../domain/product/ProductId';
import { VendorId } from '../../domain/product/VendorId';
import { Money } from '../../domain/shared/Money';
import type {
  ProductRepository,
  ProductSearchCriteria,
} from '../../domain/product/ProductRepository';
import type { Page, PageRequest } from '../../domain/shared/Pagination';

/** Escapes LIKE wildcards so user search text is matched literally. */
function likePattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

function searchConditions(criteria: ProductSearchCriteria): SQL | undefined {
  const conditions: (SQL | undefined)[] = [];
  if (criteria.vendorId) {
    conditions.push(eq(products.vendorId, criteria.vendorId.toString()));
  }
  const text = criteria.text?.trim();
  if (text) {
    const pattern = likePattern(text);
    conditions.push(or(ilike(products.name, pattern), ilike(products.description, pattern)));
  }
  if (criteria.categories && criteria.categories.length > 0) {
    conditions.push(
      inArray(
        products.category,
        criteria.categories as (typeof products.category.enumValues)[number][],
      ),
    );
  }
  if (criteria.minPriceCents !== undefined) {
    conditions.push(gte(products.priceInCents, criteria.minPriceCents));
  }
  if (criteria.maxPriceCents !== undefined) {
    conditions.push(lte(products.priceInCents, criteria.maxPriceCents));
  }
  if (criteria.inStockOnly) {
    conditions.push(gt(products.stockQuantity, 0));
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
}

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

  async search(criteria: ProductSearchCriteria, page: PageRequest): Promise<Page<Product>> {
    const where = searchConditions(criteria);
    const [rows, [{ total }]] = await Promise.all([
      this.db
        .select()
        .from(products)
        .where(where)
        .orderBy(desc(products.createdAt), desc(products.id))
        .limit(page.limit)
        .offset(page.offset),
      this.db.select({ total: count() }).from(products).where(where),
    ]);
    return { items: rows.map(toDomain), total };
  }

  async categoriesInUse(vendorId?: VendorId): Promise<string[]> {
    const rows = await this.db
      .selectDistinct({ category: products.category })
      .from(products)
      .where(vendorId ? eq(products.vendorId, vendorId.toString()) : undefined)
      .orderBy(asc(products.category));
    return rows.map((row) => row.category);
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
