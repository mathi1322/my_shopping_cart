import { ProductId } from '../../domain/product/ProductId';
import { NotFoundError } from '../../domain/shared/DomainError';
import type { ProductRepository } from '../../domain/product/ProductRepository';
import type { VendorDirectory } from '../shared/VendorDirectory';
import { nameFor } from '../shared/VendorDirectory';
import { toProductDto, type ProductDto } from './ProductDto';

export class GetProductUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly vendorDirectory: VendorDirectory,
  ) {}

  async execute(productId: string): Promise<ProductDto> {
    const product = await this.productRepository.findById(ProductId.fromString(productId));
    if (!product) {
      throw new NotFoundError(`Product ${productId} not found`);
    }
    const vendorId = product.vendorId.toString();
    const names = await this.vendorDirectory.displayNames([vendorId]);
    return toProductDto(product, nameFor(names, vendorId));
  }
}
