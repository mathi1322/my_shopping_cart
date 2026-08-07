import { ProductId } from '../../domain/product/ProductId';
import { NotFoundError } from '../../domain/shared/DomainError';
import type { ProductRepository } from '../../domain/product/ProductRepository';
import { toProductDto, type ProductDto } from './ProductDto';

export class GetProductUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(productId: string): Promise<ProductDto> {
    const product = await this.productRepository.findById(ProductId.fromString(productId));
    if (!product) {
      throw new NotFoundError(`Product ${productId} not found`);
    }
    return toProductDto(product);
  }
}
