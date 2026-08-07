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

- **Identity** (`domain/identity`) — `User` (email, password hash, role: buyer or seller), sessions. Owns authentication; product ownership and authorization live in the Product context instead (see below), because "can this seller edit this product" is a Product business rule, not an Identity one.
- **Product** (`domain/product`) — catalog data: name, description, price, stock, and which vendor (a `User.id`) owns the listing.
- **Cart** (`domain/cart`) — a cart aggregate holding line items. Product name/price/vendor are **snapshotted** into each `CartItem` at add-to-cart time, so a vendor editing a product afterwards doesn't silently change what's already in someone's cart.

These are separate aggregates on purpose: adding to a cart validates against the product's _current_ stock (an application-layer check, `AddItemToCartUseCase`), but never mutates the `Product` aggregate. Stock reservation/decrement is an order/checkout concern, which is out of scope here (see below) — keeping that mutation out of the Cart context means the two aggregates can be persisted and evolved independently.

### Domain events

Aggregates (`Product`, `Cart`) record domain events (`ProductCreated`, `CartItemAdded`, etc.) during a mutation, drained via `pullDomainEvents()` after the repository persists the change, and handed to a `DomainEventPublisher` (`application/shared/DomainEventPublisher.ts`). Today the only implementation logs them to the console — this is a deliberate seam, not a placeholder for its own sake: it's where a future subscriber (e.g. "email the vendor when their product is added to a cart") attaches, without any change to the use cases that raise the events.

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

The cart is deliberately independent of user accounts: it's identified by its own httpOnly `cartId` cookie issued on first use (`lib/http/cartCookie.ts`), not by `Astro.locals.user`. Buyers can add to cart and check out without ever registering — the same guest-checkout pattern most storefronts use — and registering doesn't change how the cart works. The trade-off this leaves open is noted under "Extension points" below.

## A note on CSRF

Astro's default `security.checkOrigin` rejects state-changing requests (POST/PUT/DELETE) whose `Origin` header doesn't match the request host. This is left **enabled** rather than disabled: because cart identity rides on a cookie, an attacker's page could otherwise trigger cart mutations in a victim's session purely via a cross-site form/fetch. Same-origin browser requests (the app's own UI) satisfy this automatically; API clients like curl/Postman need to pass a matching `Origin` header (documented in the README).

## Extension points (deliberately not built)

These were considered and intentionally left out of scope to keep the delivered surface small, fully tested, and free of half-finished auth/notification code — but the design anticipates them:

- **Order management & vendor notifications.** `Cart` already raises `CartItemAdded`/`CartItemQuantityChanged`/`CartItemRemoved` events, and Identity raises `UserRegistered`. An `Order` context (checkout, payment, fulfillment) and a real notification adapter (email/webhook) implementing `DomainEventPublisher` would subscribe to these — and to new events like `OrderPlaced` — without changing any existing use case, because publishing is already the last step of every mutation.
- **Stock reservation at checkout.** Today stock is only _checked_ (not decremented) when adding to a cart — see "Bounded contexts" above. An `Order` context would be the natural owner of actually decrementing `Product.stockQuantity`, likely via a domain service that coordinates both aggregates transactionally at checkout time.
- **Cart merge on login.** Because the cart cookie and the session cookie are independent (see "Cart identity"), a guest who adds items and _then_ logs in keeps their guest cart rather than merging it into a persistent per-account cart. Solving this properly needs a decision about cart lifetime semantics (does a logged-in buyer's cart survive across devices/browsers?) that wasn't asked for here — the two cookies were kept orthogonal specifically so this remains a clean, additive change rather than a rework.
