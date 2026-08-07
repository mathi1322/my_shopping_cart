import { ProductId } from '../../domain/product/ProductId';
import { ProductDeleted } from '../../domain/product/ProductEvents';
import { ForbiddenError, NotFoundError } from '../../domain/shared/DomainError';
import type { ProductRepository } from '../../domain/product/ProductRepository';
import type { DomainEventPublisher } from '../shared/DomainEventPublisher';
import type { RequestingUser } from '../shared/RequestingUser';

export class DeleteProductUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  async execute(productId: string, requestingUser: RequestingUser): Promise<void> {
    const id = ProductId.fromString(productId);
    const product = await this.productRepository.findById(id);
    if (!product) {
      throw new NotFoundError(`Product ${productId} not found`);
    }
    if (product.vendorId.toString() !== requestingUser.id) {
      throw new ForbiddenError('You do not own this product');
    }

    await this.productRepository.delete(id);
    await this.eventPublisher.publish([new ProductDeleted(product.id, product.vendorId)]);
  }
}
