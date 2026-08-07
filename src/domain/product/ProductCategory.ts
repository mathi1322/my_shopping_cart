/** Categories a seller can choose when listing a product. */
export const PRODUCT_CATEGORIES = [
  'Diagnostic Devices',
  'PPE & Masks',
  'Personal Care & Fitness',
  'Mobility & Support',
  'First Aid & Wellness',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/** Used only when older/internal code creates a Product without picking a category. */
export const FALLBACK_PRODUCT_CATEGORY = 'Other';

export type AnyProductCategory = ProductCategory | typeof FALLBACK_PRODUCT_CATEGORY;
