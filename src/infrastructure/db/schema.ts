import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  PRODUCT_CATEGORIES,
  FALLBACK_PRODUCT_CATEGORY,
} from '../../domain/product/ProductCategory';

export const userRole = pgEnum('user_role', ['buyer', 'seller']);

export const productCategory = pgEnum('product_category', [
  ...PRODUCT_CATEGORIES,
  FALLBACK_PRODUCT_CATEGORY,
]);

export const orderStatus = pgEnum('order_status', ['placed', 'cancelled', 'shipped', 'delivered']);
export const fulfillmentStatus = pgEnum('fulfillment_status', ['placed', 'shipped', 'delivered']);
export const paymentMethod = pgEnum('payment_method', ['cod']);

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

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('sessions_user_id_idx').on(table.userId),
    index('sessions_expires_at_idx').on(table.expiresAt),
  ],
);

export const products = pgTable(
  'products',
  {
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
  },
  (table) => [
    index('products_vendor_id_idx').on(table.vendorId),
    // Catalog pages are ordered newest first.
    index('products_created_at_idx').on(table.createdAt),
  ],
);

export const reviews = pgTable(
  'reviews',
  {
    id: text('id').primaryKey(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    // Null for seeded/demo reviews; set for reviews written by a buyer in the app.
    authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
    authorName: varchar('author_name', { length: 120 }).notNull(),
    rating: integer('rating').notNull(),
    comment: text('comment').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One review per buyer per product (NULL author_ids don't collide).
    uniqueIndex('reviews_product_id_author_id_unique').on(table.productId, table.authorId),
    index('reviews_product_id_created_at_idx').on(table.productId, table.createdAt),
  ],
);

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

export const orders = pgTable(
  'orders',
  {
    id: text('id').primaryKey(),
    buyerId: text('buyer_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    buyerEmail: text('buyer_email').notNull(),
    deliveryAddress: text('delivery_address').notNull(),
    deliveryPhone: varchar('delivery_phone', { length: 20 }).notNull(),
    paymentMethod: paymentMethod('payment_method').notNull().default('cod'),
    status: orderStatus('status').notNull().default('placed'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('orders_buyer_id_created_at_idx').on(table.buyerId, table.createdAt)],
);

export const orderItems = pgTable(
  'order_items',
  {
    orderId: text('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    // Not a live FK: an order is a historical snapshot that must survive the
    // product being edited or deleted later (see productName/vendorId below).
    productId: text('product_id').notNull(),
    productName: varchar('product_name', { length: 200 }).notNull(),
    productImage: text('product_image'),
    vendorId: text('vendor_id').notNull(),
    unitPriceInCents: integer('unit_price_in_cents').notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('INR'),
    quantity: integer('quantity').notNull(),
    fulfillmentStatus: fulfillmentStatus('fulfillment_status').notNull().default('placed'),
  },
  (table) => [
    primaryKey({ columns: [table.orderId, table.productId] }),
    index('order_items_vendor_id_idx').on(table.vendorId),
    index('order_items_product_id_idx').on(table.productId),
  ],
);
