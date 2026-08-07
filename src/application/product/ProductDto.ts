import type { Product } from '../../domain/product/Product';

export interface ProductDto {
  id: string;
  vendorId: string;
  name: string;
  description: string;
  priceInCents: number;
  currency: string;
  stockQuantity: number;
  createdAt: string;
  updatedAt: string;
}

export function toProductDto(product: Product): ProductDto {
  return {
    id: product.id.toString(),
    vendorId: product.vendorId.toString(),
    name: product.name,
    description: product.description,
    priceInCents: product.price.cents,
    currency: product.price.currencyCode,
    stockQuantity: product.stockQuantity,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}
