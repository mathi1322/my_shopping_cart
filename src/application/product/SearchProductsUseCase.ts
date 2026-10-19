import { VendorId } from '../../domain/product/VendorId';
import type { ProductRepository } from '../../domain/product/ProductRepository';
import type { VendorDirectory } from '../shared/VendorDirectory';
import { nameFor } from '../shared/VendorDirectory';
import { pageInfo, resolvePage, type PageQuery, type Paged } from '../shared/Paging';
import { toProductDto, type ProductDto } from './ProductDto';

export const CATALOG_PAGE_SIZE = 12;

export interface SearchProductsQuery extends PageQuery {
  vendorId?: string;
  text?: string;
  categories?: string[];
  minPriceCents?: number;
  maxPriceCents?: number;
  inStockOnly?: boolean;
}

export interface SearchProductsResult extends Paged {
  products: ProductDto[];
  /** Categories available to filter by (for the vendor, if one is selected). */
  categories: string[];
}

export class SearchProductsUseCase {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly vendorDirectory: VendorDirectory,
  ) {}

  async execute(query: SearchProductsQuery = {}): Promise<SearchProductsResult> {
    const { page, pageSize, request } = resolvePage(query, {
      pageSize: CATALOG_PAGE_SIZE,
      maxPageSize: 100,
    });
    const vendorId = query.vendorId ? VendorId.fromString(query.vendorId) : undefined;

    const [result, categories] = await Promise.all([
      this.productRepository.search(
        {
          vendorId,
          text: query.text,
          categories: query.categories,
          minPriceCents: query.minPriceCents,
          maxPriceCents: query.maxPriceCents,
          inStockOnly: query.inStockOnly,
        },
        request,
      ),
      this.productRepository.categoriesInUse(vendorId),
    ]);

    const names = await this.vendorDirectory.displayNames(
      result.items.map((product) => product.vendorId.toString()),
    );
    return {
      products: result.items.map((product) =>
        toProductDto(product, nameFor(names, product.vendorId.toString())),
      ),
      categories,
      ...pageInfo(result.total, page, pageSize),
    };
  }
}
