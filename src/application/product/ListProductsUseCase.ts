import { VendorId } from '../../domain/product/VendorId';
import type { ProductRepository } from '../../domain/product/ProductRepository';
import { toProductDto, type ProductDto } from './ProductDto';

export interface ListProductsFilter {
  vendorId?: string;
}

export class ListProductsUseCase {
  constructor(private readonly productRepository: ProductRepository) {}

  async execute(filter: ListProductsFilter = {}): Promise<ProductDto[]> {
    const products = filter.vendorId
      ? await this.productRepository.findByVendorId(VendorId.fromString(filter.vendorId))
      : await this.productRepository.findAll();

    return products.map(toProductDto);
  }
}
