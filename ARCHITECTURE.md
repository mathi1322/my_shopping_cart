# Architecture

## Why Astro for the backend too

Astro's server API routes (`src/pages/api/**`) are plain `(context) => Response` functions with full access to the request, cookies, and params — a real REST backend, not a workaround. Running the API and the UI as one Astro server (via `@astrojs/node` in standalone mode) means one process, one Dockerfile, one deploy artifact, instead of a second Express/Fastify service duplicating routing, validation, and container config for no functional gain.

## Why PostgreSQL + Drizzle

Products and cart items are inherently relational (a cart item references a product; totals are computed by joining quantity × price), so a relational database was chosen over Mongo/SQLite. Drizzle was chosen over Prisma because its schema is plain TypeScript with no code-generation step in the loop — that keeps the unit-test red/green cycle fast — and its query builder maps cleanly onto a repository interface as a thin adapter, rather than leaking an ORM-specific API into the domain layer.

## Layering (hexagonal / DDD)

```
pages/api/*  (Astro routes)        — thin: validate (Zod) → call a use case → map result to JSON/status
        │
application/*  (use cases, DTOs)   — orchestrates the domain; the only layer that talks to repository interfaces
        │
domain/*  (entities, value objects, domain events, repository interfaces) — no I/O, no framework imports
        │
infrastructure/*  (Drizzle schema, repositories, DI container) — implements the domain's repository interfaces
```

Dependencies point inward only: `domain` knows nothing about `application`, `infrastructure`, or Astro. `infrastructure` depends on `domain` (to implement its interfaces), never the reverse. This is what makes the domain and application layers unit-testable with in-memory fakes (`tests/unit/**`) with zero database — see `tests/unit/application/_fakes/`.

### Bounded contexts

- **Identity** (`domain/identity`) — `User` (email, password hash, role: buyer or seller, profile details), sessions. Owns authentication; product ownership and authorization live in the Product context instead (see below), because "can this seller edit this product" is a Product business rule, not an Identity one.
- **Product** (`domain/product`) — catalog data: name, description, price, stock, category, and which vendor (a `User.id`) owns the listing.
- **Cart** (`domain/cart`) — a cart aggregate holding line items. Product name/price/vendor/image are **snapshotted** into each `CartItem` at add-to-cart time, so a vendor editing a product afterwards doesn't silently change what's already in someone's cart.
- **Order** (`domain/order`) — created from a buyer's cart at checkout (`PlaceOrderUseCase`). Snapshots the same per-item fields as `CartItem` (name/price/vendor/image), plus the buyer's email, delivery address/phone, and a `status` of `placed`/`cancelled`. A `VendorId` on each line item is what lets `ListOrdersForVendorUseCase` answer "which orders contain my products" without Order depending on Product.

These are separate aggregates on purpose: adding to a cart validates against the product's _current_ stock (an application-layer check, `AddItemToCartUseCase`) but never mutates the `Product` aggregate — the cart is just a working list. Stock is only actually decremented when an `Order` is placed (and restored if it's cancelled), because that's the point where a buyer is committing to a purchase; keeping that mutation out of the Cart context means the cart and product aggregates can still be persisted and evolved independently.

### Domain events

Aggregates (`Product`, `Cart`, `Order`, `User`) record domain events (`ProductCreated`, `CartItemAdded`, `OrderPlaced`, `OrderCancelled`, etc.) during a mutation, drained via `pullDomainEvents()` after the repository persists the change, and handed to a `DomainEventPublisher` (`application/shared/DomainEventPublisher.ts`). Today the only implementation logs them to the console — this is a deliberate seam, not a placeholder for its own sake: it's where a future subscriber (e.g. "email the vendor when they receive an order") attaches, without any change to the use cases that raise the events. The seller-facing "Orders Received" notification badge in the header is deliberately built as an in-app, polled count rather than through this event log — see "Extension points" below for why.

## Authentication & authorization

**Sessions, not JWTs.** Login/register issue an opaque random token (`node:crypto` `randomBytes(32)`) stored in a `sessions` table (`user_id`, `expires_at`) and set as an httpOnly cookie. This was chosen over a signed JWT because it needs no `SESSION_SECRET` to manage, and — unlike a self-contained JWT — a session can be revoked server-side (logout actually invalidates it, rather than just deleting a cookie the client could resend). The cost is a DB lookup per request, which is irrelevant at this scale.

**Password hashing** uses Node's built-in `scrypt` (`infrastructure/auth/ScryptPasswordHasher.ts`) via a domain-owned `PasswordHasher` interface (`domain/identity/PasswordHasher.ts`) — same pattern as a repository: the domain declares the port, infrastructure implements it. No bcrypt/argon2 dependency needed for a project this size.

**Where authorization checks live**, split by what kind of question they answer:

- _Are you logged in at all?_ — plumbing, not a business rule. Checked once per route via `lib/http/requireUser.ts`, called from the API route before invoking a use case.
- _Are you allowed to do **this**?_ — a business rule, so it lives in the use case, not the route:
  - `CreateProductUseCase` checks `role === 'seller'` — there's no existing product to compare against yet.
  - `UpdateProductUseCase` / `DeleteProductUseCase` check `product.vendorId === requestingUser.id`. This single ownership check is also sufficient to reject buyers — a buyer's id can never equal a product's `vendorId` — so there's no separate role check needed on those two paths.

**`src/middleware.ts`** runs on every request, resolves the `sessionId` cookie to a user via `ResolveSessionUseCase`, and sets `Astro.locals.user` (typed via `src/env.d.ts`) — both API routes and `.astro` pages read from there rather than re-deriving it.

## Error handling convention

Domain/application code throws typed errors — `ValidationError`, `NotFoundError`, `ConflictError` (`domain/shared/DomainError.ts`) — instead of returning error codes or nulls. Exactly one place maps them to HTTP: `lib/http/errorResponse.ts`, which also catches Zod validation errors and malformed JSON. Route handlers stay a uniform `try { ... } catch (error) { return toErrorResponse(error) }` — new error types added to the domain automatically get a sensible HTTP status without touching every route.

## Cart identity

The cart belongs to a user account: `carts.user_id` is a unique, non-null foreign key to `users.id`, and `GetOrCreateCartUseCase` looks up (or creates) a cart by `userId`, never by a client-supplied id. All cart routes (`/api/cart`, `/api/cart/items*`) call `requireUser(locals.user)` and derive the cart strictly from the authenticated session — there is no guest cart and no cart-identifying cookie. The `/cart` page itself redirects anonymous visitors to `/`, and the UI (`AddToCartControl`, `CartBadge`) opens a login modal before attempting any cart action while logged out, so a user is never routed into a 401. This also means switching accounts in the same browser can never leak another user's cart contents — cart rows are looked up by `userId`, not by anything stored client-side.

## A note on CSRF

Astro's default `security.checkOrigin` rejects state-changing requests (POST/PUT/DELETE) whose `Origin` header doesn't match the request host. This is left **enabled** rather than disabled: cart and session identity both ride on cookies, so an attacker's page could otherwise trigger mutations in a victim's session purely via a cross-site form/fetch. Same-origin browser requests (the app's own UI) satisfy this automatically; API clients like curl/Postman need to pass a matching `Origin` header (documented in the README).

## Extension points (deliberately not built)

These were considered and intentionally left out of scope to keep the delivered surface small, fully tested, and free of half-finished auth/notification code — but the design anticipates them:

- **Real (off-app) notifications.** A seller "receiving a notification" for a new order is, today, an in-app badge count on the account menu (`AuthStatus.tsx` polls `GET /api/orders/received` and counts `status: 'placed'`) plus the "Orders Received" list itself — not an email, SMS, or push notification. `OrderPlaced` is already published through `DomainEventPublisher`, so a real notification adapter (email/webhook) would subscribe there without touching `PlaceOrderUseCase` at all; it just hasn't been built, in keeping with this project's existing practice of not standing up notification infrastructure that has no real transport behind it yet.
- **Payment.** Cash on Delivery is the only `paymentMethod` (`domain/order/Order.ts` types it as the literal `'cod'`). There's no payment gateway integration, so nothing to reconcile if a real payment fails.
- **Order fulfillment beyond placed/cancelled.** `OrderStatus` is intentionally just `'placed' | 'cancelled'` — no `shipped`/`delivered`/`returned` workflow, since nothing in the current UI acts on those states yet. Adding them is additive (new enum values + a status-specific action), not a redesign.
- **Product images as uploads.** `products.images` stores an array of externally-hosted URLs that sellers paste in directly (`ImageUrlsField` in `SellerProductManager.tsx`) — there's no file upload endpoint or persistent object storage. Adding real uploads would mean introducing a storage adapter (disk volume or S3-compatible bucket) plus upload validation (content-type sniffing, size limits), which is a meaningfully bigger surface than URL references.
