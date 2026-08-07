import { ProductId } from '../../domain/product/ProductId';
import { Money } from '../../domain/shared/Money';
import { ForbiddenError, NotFoundError } from '../../domain/shared/DomainError';
import type { ProductRepository } from '../../domain/product/ProductRepository';
import type { DomainEventPublisher } from '../shared/DomainEventPublisher';
import type { RequestingUser } from '../shared/RequestingUser';
import { toProductDto, type ProductDto } from './ProductDto';

export interface UpdateProductInput {
  name?: string;
  description?: string;
  priceInCents?: number;
  stockQuantity?: number;
}

export class UpdateProductUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(
    productId: string,
    input: UpdateProductInput,
    requestingUser: RequestingUser,
  ): Promise<ProductDto> {
    const id = ProductId.fromString(productId);
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new NotFoundError(`Product ${productId} not found`);
    }
    if (product.vendorId.toString() !== requestingUser.id) {
      throw new ForbiddenError('You do not own this product');
    }

    product.updateDetails({
      name: input.name,
      description: input.description,
      price: input.priceInCents !== undefined ? Money.fromCents(input.priceInCents) : undefined,
      stockQuantity: input.stockQuantity,
    });

    await this.productRepository.save(product);
    await this.eventPublisher.publish(product.pullDomainEvents());

    return toProductDto(product);
  }
}
