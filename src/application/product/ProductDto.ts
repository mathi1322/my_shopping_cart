import type { Product } from '../../domain/product/Product';
import { FALLBACK_VENDOR_NAME } from '../shared/VendorDirectory';

export interface ProductDto {
  id: string;
  vendorId: string;
  /** How the seller is shown to shoppers (company name, else their name). */
  vendorName: string;
  name: string;
  description: string;
  priceInCents: number;
  currency: string;
  stockQuantity: number;
  category: string;
  features: string[];
  images: string[];
  createdAt: string;
  updatedAt: string;
}

export function toProductDto(
  product: Product,
  vendorName: string = FALLBACK_VENDOR_NAME,
): ProductDto {
  return {
    id: product.id.toString(),
    vendorId: product.vendorId.toString(),
    vendorName,
    name: product.name,
    description: product.description,
    priceInCents: product.price.cents,
    currency: product.price.currencyCode,
    stockQuantity: product.stockQuantity,
    category: product.category,
    features: product.features,
    images: product.images,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
  };
}
