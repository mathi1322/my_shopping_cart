# MediKart

A medical & wellness e-commerce marketplace — product catalog with categories and filters, cart, Cash-on-Delivery checkout, order history and cancellation, seller product management, and a seller analytics dashboard — built with **Astro (TypeScript, SSR API routes)**, **PostgreSQL**, and **Drizzle ORM**, following **Domain-Driven Design** and **Test-Driven Development**. Fully containerized with **Docker Compose**.

The visual theme (header, cards, pill badges, sidebar filters) is deliberately modeled on [iCliniq](https://www.icliniq.com)'s design language, since the catalog itself is medical/wellness devices (thermometers, pulse oximeters, blood pressure monitors, PPE, and similar).

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the design rationale, layering, bounded contexts, and documented extension points.

## Tech stack

| Concern          | Choice                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------- |
| Framework        | Astro 7 (TypeScript), SSR API routes as the backend — no separate server                  |
| UI               | Astro pages + Preact islands for interactivity, Tailwind CSS v4                           |
| Database         | PostgreSQL 16                                                                             |
| ORM              | Drizzle ORM + drizzle-kit migrations                                                      |
| Validation       | Zod at the API boundary                                                                   |
| Auth             | Session cookie + server-side session store, scrypt password hashing (no extra dependency) |
| Testing          | Vitest (unit + integration)                                                               |
| Containerization | Docker + Docker Compose                                                                   |

## Features

**Buyers** can:

- Browse the catalog with a left-hand sidebar of filters — category, price band, in-stock only — plus free-text search, all as plain GET query params (shareable/bookmarkable, no client-side JS required to filter)
- View a product's detail page: image gallery (multiple photos with thumbnail switching), description, features, and buyer reviews with a star rating average
- Add to cart, adjust quantities, and check out with **Cash on Delivery** (the only payment method) through a two-step address → confirm flow
- View order history at **My Orders** and cancel a `placed` order (stock is restored automatically)
- Manage a profile at **Settings** — name, phone, address

**Sellers** additionally get:

- A product management screen (**My Products**, `/sell`) to add/edit/delete their own listings — name, description, price, stock, category, and up to 8 image URLs
- **Orders Received** (`/sell/orders`) — every order containing at least one of their products, narrowed to just their own line items even when an order spans multiple sellers, with the buyer's email and delivery details
- A live badge on the account menu showing how many `placed` (unfulfilled) orders they have
- A **Dashboard** (`/sell/dashboard`) with total revenue (+ week-over-week change), order/cancellation counts, unique customers, average order value, a 14-day revenue trend chart, a top-3-products-by-revenue donut chart, a revenue-by-category breakdown, and a recent-orders table
- Seller-only profile fields — company name, company address, and an optional GST number
- A read-only storefront view of their own catalog, and a "View my store" link from their profile

Everything above is server-rendered from real Postgres data — there's no mocked or hard-coded dashboard/report data anywhere.

## Accounts: buyers and sellers

There are two roles, chosen at registration:

- **Buyer** — browse, filter, and search products; use the cart; place Cash-on-Delivery orders; view and cancel orders; manage a personal profile.
- **Seller** — everything a buyer can do, plus product management, an incoming-orders view, a sales dashboard, and company/GST profile fields. A seller can only ever modify products they created, and only ever cancel orders they placed as a buyer (not orders placed _for_ their products — that action belongs to the buyer who placed it).

Register at `/register`, log in at `/login`. Once logged in, the account menu (top right) links to Profile, My Orders, My Cart, and — for sellers — Dashboard, My Products, My Store, and Orders Received.

The Docker seed also creates 3 demo sellers and 1 demo buyer (password `password123` for all): `seller1@medikart.test`, `seller2@medikart.test`, `seller3@medikart.test`, `buyer@medikart.test`, along with 5 demo products (with real product photos) and a handful of seeded reviews.

## Quick start (Docker)

This is the fastest way to see the whole thing running — Postgres, migrations, demo data, and the app, in one command.

```sh
docker compose up
```

This starts, in order: `db` (Postgres, with a healthcheck) → `migrate` (applies the schema) → `seed` (registers demo accounts, 5 demo products, and their reviews — skipped if products already exist) → `app` (the Astro server).

Once it's up:

- App: http://localhost:4321
- Cart page: http://localhost:4321/cart
- API: http://localhost:4321/api/products

To customize ports/credentials, copy `.env.example` to `.env` first — `docker-compose.yml` reads `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, and `APP_PORT` from it (all have sane defaults if you skip this). If port 5432 is already taken on your machine by a local Postgres install, change `POSTGRES_PORT` (and `DATABASE_URL`'s port) to something else, e.g. 5433.

Stop everything with `docker compose down` (add `-v` to also drop the Postgres volume and its data).

### Deploying beyond localhost

Set `ALLOWED_HOSTS` (comma-separated public hostnames, e.g. `ALLOWED_HOSTS=shop.example.com`) when building the image. Astro only trusts the `Host`/`X-Forwarded-*` headers for allowed hosts; without it, same-origin checks reject logout and order cancellation and every visitor shares one rate-limit bucket. Serve the app over HTTPS (the session cookie is `Secure` in production) behind a reverse proxy that overwrites `X-Forwarded-For`, and don't expose the app port directly. See `.env.example` for `COOKIE_SECURE`.

## Local development (without Docker)

Requires Node.js 22+ and a running Postgres instance.

```sh
npm install
cp .env.example .env   # edit DATABASE_URL if your Postgres isn't on localhost:5432
npm run db:migrate
npm run db:seed        # optional — adds demo accounts, 5 demo products, and reviews
npm run dev
```

## Testing

```sh
npm run test              # unit tests — domain + application layers, no I/O
npm run test:coverage     # same, with coverage
npm run test:integration  # integration tests — real Postgres required (DATABASE_URL env var)
```

Integration tests exercise the actual Drizzle repositories and the actual Astro API route handlers against a real database — nothing is mocked at that layer. Point `DATABASE_URL` at a disposable database before running them, e.g.:

```sh
docker run -d --name shopping_cart_test_db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=shopping_cart_test -p 5433:5432 postgres:16-alpine
DATABASE_URL=postgres://postgres:postgres@localhost:5433/shopping_cart_test npm run db:migrate
DATABASE_URL=postgres://postgres:postgres@localhost:5433/shopping_cart_test npm run test:integration
```

**Note:** the integration suite truncates every table before each test file runs (`tests/integration/setupDb.ts`), so it refuses to run unless the database name contains `test`. Always point it at a disposable database, never at your development or seeded one.

CI (`.github/workflows/ci.yml`) runs formatting, lint, typecheck, unit tests, integration tests against a Postgres service, the production build, and a runtime dependency audit on every push and pull request.

## API reference

All responses are JSON. Errors use the shape `{ "error": { "code": "...", "message": "...", "details"?: ... } }` with status 400 (validation), 401 (not logged in), 403 (logged in, but wrong role or not the owner), 404 (not found), 409 (conflict, e.g. insufficient stock, cart already empty, order already cancelled, or a price changed since the item was added — the cart is repriced so the buyer can review and resubmit), 429 (too many login/register attempts; see the `Retry-After` header), or 500.

Not everything in the app goes through a JSON API — product reviews and the seller dashboard are read directly by their `.astro` pages via a use case (`container.listReviewsForProduct` / `container.getSellerDashboard`), since only that page ever needs the data and a round-trip through `fetch` would be pure overhead. Only endpoints actually called from client-side code are listed below.

**Note on state-changing requests:** Astro's built-in CSRF protection (`security.checkOrigin`, on by default) rejects POST/PUT/DELETE requests whose `Origin` header doesn't match the request host. Browser `fetch` calls from the app's own UI satisfy this automatically. When testing with curl/Postman, add `-H "Origin: http://localhost:4321"`.

### Auth

Sessions are an httpOnly `sessionId` cookie backed by a server-side session table (not a JWT) — set automatically by register/login, cleared by logout.

| Method | Path                 | Body                        | Notes                                                      |
| ------ | -------------------- | --------------------------- | ---------------------------------------------------------- |
| POST   | `/api/auth/register` | `{ email, password, role }` | `role` is `"buyer"` or `"seller"`; 201, 409 if email taken |
| POST   | `/api/auth/login`    | `{ email, password }`       | 401 on wrong email/password                                |
| POST   | `/api/auth/logout`   | —                           | 204, clears the session                                    |
| GET    | `/api/auth/me`       | —                           | `{ user: UserDto \| null }`                                |

### Users (profile)

| Method | Path            | Body                                                                             | Notes                                                                                                       |
| ------ | --------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| PUT    | `/api/users/me` | Any subset of `{ name, phone, address, companyName, companyAddress, gstNumber }` | Requires login; an empty string clears a field to `null`; `gstNumber` is optional and unvalidated in format |

### Products

Fetching is public. Creating/updating/deleting requires a logged-in seller, and updates/deletes are further restricted to the product's own seller (enforced in the use case, not just the route).

`category` must be one of the fixed values in `domain/product/ProductCategory.ts` (currently: `Diagnostic Devices`, `PPE & Masks`, `Personal Care & Fitness`, `Mobility & Support`, `First Aid & Wellness`). `images` is an array of up to 8 externally-hosted URLs (no file upload — see [ARCHITECTURE.md](./ARCHITECTURE.md)).

| Method | Path                | Body                                                                                 | Notes                                                                |
| ------ | ------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| GET    | `/api/products`     | —                                                                                    | Lists all products; `?vendorId=` filters to one seller               |
| POST   | `/api/products`     | `{ name, description?, priceInCents, stockQuantity, category, images? }`             | Seller-only; 201; `vendorId` is taken from the session, not the body |
| GET    | `/api/products/:id` | —                                                                                    | 404 if unknown                                                       |
| PUT    | `/api/products/:id` | Any subset of `{ name, description, priceInCents, stockQuantity, category, images }` | Owning seller only; 403 otherwise                                    |
| DELETE | `/api/products/:id` | —                                                                                    | Owning seller only; 204; 403 otherwise                               |

The home page (`/`) itself supports `?q=` (search), `?category=` (repeatable), `?priceBand=` (`under-1000` / `1000-2000` / `above-2000`), `?inStock=1`, and `?vendorId=` as plain page query params — these filter server-side in `pages/index.astro`, not through the JSON API above.

### Cart

The cart belongs to the logged-in user (`carts.user_id`, unique per user) — **there is no guest cart**. Every route below requires a session and operates on the caller's own cart; there's no cart-identifying cookie or client-supplied cart id.

| Method | Path                         | Body                      | Notes                                                     |
| ------ | ---------------------------- | ------------------------- | --------------------------------------------------------- |
| GET    | `/api/cart`                  | —                         | Returns (or creates) the caller's cart; 401 if logged out |
| POST   | `/api/cart/items`            | `{ productId, quantity }` | 201, 404 unknown product, 409 insufficient stock          |
| PUT    | `/api/cart/items/:productId` | `{ quantity }`            | Sets absolute quantity; 404/409 as above                  |
| DELETE | `/api/cart/items/:productId` | —                         | Removes the line item                                     |

### Orders

Placing an order snapshots the caller's current cart into an `Order`, re-checks stock for every item, decrements it, and empties the cart. Cancelling restores that stock. `paymentMethod` is always `"cod"` — Cash on Delivery is the only option today.

| Method | Path                     | Body                                 | Notes                                                                                                          |
| ------ | ------------------------ | ------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| GET    | `/api/orders`            | —                                    | Lists the caller's own orders (as buyer), most recent first                                                    |
| POST   | `/api/orders`            | `{ deliveryAddress, deliveryPhone }` | 201; 409 if the cart is empty or stock no longer covers a cart item                                            |
| GET    | `/api/orders/received`   | —                                    | Seller-only (403 for buyers); orders containing any of the caller's products, items narrowed to just their own |
| POST   | `/api/orders/:id/cancel` | —                                    | Buyer-only, and only the order's own buyer; 403 otherwise; 409 if already cancelled                            |

## Project structure

```
src/
  domain/              # entities, value objects, domain events, repository interfaces — no I/O
    product/ cart/ order/ review/ identity/ shared/
  application/         # use cases (one per operation), DTOs — orchestrates the domain
    product/ cart/ order/ review/ identity/ analytics/ shared/
  infrastructure/      # Drizzle schema/client, repository implementations, DI container
    db/ repositories/ auth/ di/
  lib/                 # Zod schemas, HTTP helpers (error mapping, cookies, requireUser), placeholderTile
  middleware.ts        # resolves the session cookie into Astro.locals.user on every request
  env.d.ts             # App.Locals typing
  pages/
    api/               # REST endpoints (thin — validate, call a use case, map the result)
    index.astro        # product listing + sidebar filters (public)
    products/[id].astro # product detail: gallery, features, reviews
    cart.astro          # cart page + checkout flow
    orders/index.astro   # buyer's own order history + cancel
    profile/index.astro  # Settings tab (personal + seller company/GST fields)
    sell/
      index.astro        # My Products (seller product management)
      orders.astro        # Orders Received (seller)
      dashboard.astro      # seller analytics dashboard (charts, KPIs)
    login.astro register.astro
  components/            # Preact islands + a couple of shared .astro partials
    AddToCartControl CartView CartBadge AuthStatus LoginForm LoginModal RegisterForm
    SellerProductManager MyOrders SellerOrders ProfileSettingsForm ProfileTabs.astro
tests/
  unit/                  # domain + application layer, fully isolated (in-memory fakes)
  integration/           # repositories and API routes against a real Postgres
drizzle/                 # generated SQL migrations
```
