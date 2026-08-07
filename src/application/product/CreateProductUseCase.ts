import { Product } from '../../domain/product/Product';
import { VendorId } from '../../domain/product/VendorId';
import { Money } from '../../domain/shared/Money';
import { ForbiddenError } from '../../domain/shared/DomainError';
import type { ProductRepository } from '../../domain/product/ProductRepository';
import type { AnyProductCategory } from '../../domain/product/ProductCategory';
import type { DomainEventPublisher } from '../shared/DomainEventPublisher';
import type { RequestingUser } from '../shared/RequestingUser';
import { toProductDto, type ProductDto } from './ProductDto';

export interface CreateProductInput {
  name: string;
  description: string;
  priceInCents: number;
  stockQuantity: number;
  category?: AnyProductCategory;
  features?: string[];
  images?: string[];
}

export class CreateProductUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(input: CreateProductInput, requestingUser: RequestingUser): Promise<ProductDto> {
    if (requestingUser.role !== 'seller') {
      throw new ForbiddenError('Only sellers can list products');
    }

    const product = Product.create({
      vendorId: VendorId.fromString(requestingUser.id),
      name: input.name,
      description: input.description,
      price: Money.fromCents(input.priceInCents),
      stockQuantity: input.stockQuantity,
      category: input.category,
      features: input.features,
      images: input.images,
    });

    await this.productRepository.save(product);
    await this.eventPublisher.publish(product.pullDomainEvents());

    return toProductDto(product);
  }
}
