import { AggregateRoot } from '../shared/AggregateRoot';
import { ValidationError } from '../shared/DomainError';
import { Money } from '../shared/Money';
import { ProductId } from './ProductId';
import { VendorId } from './VendorId';
import { FALLBACK_PRODUCT_CATEGORY, type AnyProductCategory } from './ProductCategory';
import { ProductCreated, ProductUpdated } from './ProductEvents';

export interface ProductProps {
  id: ProductId;
  vendorId: VendorId;
  name: string;
  description: string;
  price: Money;
  stockQuantity: number;
  category: AnyProductCategory;
  features: string[];
  images: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProductInput {
  vendorId: VendorId;
  name: string;
  description: string;
  price: Money;
  stockQuantity: number;
  category?: AnyProductCategory;
  features?: string[];
  images?: string[];
}

export interface UpdateProductInput {
  name?: string;
  description?: string;
  price?: Money;
  stockQuantity?: number;
  category?: AnyProductCategory;
  images?: string[];
}

const MAX_NAME_LENGTH = 200;
const MAX_DESCRIPTION_LENGTH = 2000;

export class Product extends AggregateRoot {
  private constructor(private props: ProductProps) {
    super();
  }

  static create(input: CreateProductInput): Product {
    Product.assertName(input.name);
    Product.assertDescription(input.description);
    Product.assertStock(input.stockQuantity);

    const now = new Date();
    const product = new Product({
      id: ProductId.create(),
      vendorId: input.vendorId,
      name: input.name.trim(),
      description: input.description.trim(),
      price: input.price,
      stockQuantity: input.stockQuantity,
      category: input.category ?? FALLBACK_PRODUCT_CATEGORY,
      features: input.features ?? [],
      images: input.images ?? [],
      createdAt: now,
      updatedAt: now,
    });
    product.addDomainEvent(new ProductCreated(product.id, product.vendorId));
    return product;
  }

  /** Rebuilds a Product from persisted state — bypasses creation invariants/events. */
  static reconstitute(props: ProductProps): Product {
    return new Product(props);
  }

  updateDetails(input: UpdateProductInput): void {
    if (input.name !== undefined) {
      Product.assertName(input.name);
      this.props.name = input.name.trim();
    }
    if (input.description !== undefined) {
      Product.assertDescription(input.description);
      this.props.description = input.description.trim();
    }
    if (input.price !== undefined) {
      this.props.price = input.price;
    }
    if (input.stockQuantity !== undefined) {
      Product.assertStock(input.stockQuantity);
      this.props.stockQuantity = input.stockQuantity;
    }
    if (input.category !== undefined) {
      this.props.category = input.category;
    }
    if (input.images !== undefined) {
      this.props.images = input.images;
    }
    this.props.updatedAt = new Date();
    this.addDomainEvent(new ProductUpdated(this.id));
  }

  get id(): ProductId {
    return this.props.id;
  }

  get vendorId(): VendorId {
    return this.props.vendorId;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string {
    return this.props.description;
  }

  get price(): Money {
    return this.props.price;
  }

  get stockQuantity(): number {
    return this.props.stockQuantity;
  }

  get category(): AnyProductCategory {
    return this.props.category;
  }

  get features(): string[] {
    return this.props.features;
  }

  get images(): string[] {
    return this.props.images;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  hasStockFor(quantity: number): boolean {
    return this.props.stockQuantity >= quantity;
  }

  private static assertName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new ValidationError('Product name cannot be empty');
    }
    if (name.trim().length > MAX_NAME_LENGTH) {
      throw new ValidationError(`Product name cannot exceed ${MAX_NAME_LENGTH} characters`);
    }
  }

  private static assertDescription(description: string): void {
    if (description.length > MAX_DESCRIPTION_LENGTH) {
      throw new ValidationError(
        `Product description cannot exceed ${MAX_DESCRIPTION_LENGTH} characters`,
      );
    }
  }

  private static assertStock(stock: number): void {
    if (!Number.isInteger(stock) || stock < 0) {
      throw new ValidationError('Stock quantity must be a non-negative integer');
    }
  }
}
