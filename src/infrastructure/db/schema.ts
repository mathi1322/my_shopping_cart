import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { PRODUCT_CATEGORIES, FALLBACK_PRODUCT_CATEGORY } from '../../domain/product/ProductCategory';

export const userRole = pgEnum('user_role', ['buyer', 'seller']);

export const productCategory = pgEnum('product_category', [
  ...PRODUCT_CATEGORIES,
  FALLBACK_PRODUCT_CATEGORY,
]);

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRole('role').notNull(),
  name: varchar('name', { length: 200 }),
  phone: varchar('phone', { length: 20 }),
  address: text('address'),
  companyName: varchar('company_name', { length: 200 }),
  companyAddress: text('company_address'),
  gstNumber: varchar('gst_number', { length: 15 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable('products', {
  id: text('id').primaryKey(),
  vendorId: text('vendor_id')
    .notNull()
    .references(() => users.id),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description').notNull(),
  priceInCents: integer('price_in_cents').notNull(),
  currency: varchar('currency', { length: 3 }).notNull().default('INR'),
  stockQuantity: integer('stock_quantity').notNull(),
  category: productCategory('category').notNull().default(FALLBACK_PRODUCT_CATEGORY),
  features: jsonb('features').$type<string[]>().notNull().default([]),
  images: jsonb('images').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const reviews = pgTable('reviews', {
  id: text('id').primaryKey(),
  productId: text('product_id')
    .notNull()
    .references(() => products.id, { onDelete: 'cascade' }),
  authorName: varchar('author_name', { length: 120 }).notNull(),
  rating: integer('rating').notNull(),
  comment: text('comment').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const carts = pgTable('carts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const cartItems = pgTable(
  'cart_items',
  {
    cartId: text('cart_id')
      .notNull()
      .references(() => carts.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    productName: varchar('product_name', { length: 200 }).notNull(),
    productImage: text('product_image'),
    vendorId: text('vendor_id').notNull(),
    unitPriceInCents: integer('unit_price_in_cents').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('INR'),
    quantity: integer('quantity').notNull(),
  },
  (table) => [primaryKey({ columns: [table.cartId, table.productId] })],
);
