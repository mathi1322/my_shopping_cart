# Shopping Cart

A small e-commerce shopping cart application — product catalog, cart, and seller/buyer accounts — built with **Astro (TypeScript, SSR API routes)**, **PostgreSQL**, and **Drizzle ORM**, following **Domain-Driven Design** and **Test-Driven Development**. Fully containerized with **Docker Compose**.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the design rationale, layering, and documented extension points (order management, vendor notifications).

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

## Accounts: buyers and sellers

There are two roles, chosen at registration:

- **Buyer** — browse products and use the cart. Buyers don't strictly need an account (the cart works anonymously via cookie), but registering lets you have an identity in the header.
- **Seller** — everything a buyer can do, plus a "My Products" dashboard (`/sell`) to add, edit, and delete their own product listings. A seller can only ever modify products they created.

Register at `/register`, log in at `/login`. The Docker seed also creates 3 demo sellers and 1 demo buyer (password `password123` for all): `seller1@shopkart.test`, `seller2@shopkart.test`, `seller3@shopkart.test`, `buyer@shopkart.test`.

## Quick start (Docker)

This is the fastest way to see the whole thing running — Postgres, migrations, demo data, and the app, in one command.

```sh
docker compose up
```

This starts, in order: `db` (Postgres, with a healthcheck) → `migrate` (applies the schema) → `seed` (registers demo accounts and 5 demo products, skipped if products already exist) → `app` (the Astro server).

Once it's up:

- App: http://localhost:4321
- Cart page: http://localhost:4321/cart
- API: http://localhost:4321/api/products

To customize ports/credentials, copy `.env.example` to `.env` first — `docker-compose.yml` reads `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`, and `APP_PORT` from it (all have sane defaults if you skip this).

Stop everything with `docker compose down` (add `-v` to also drop the Postgres volume and its data).

## Local development (without Docker)

Requires Node.js 22+ and a running Postgres instance.

```sh
npm install
cp .env.example .env   # edit DATABASE_URL if your Postgres isn't on localhost:5432
npm run db:migrate
npm run db:seed        # optional — adds demo accounts + 5 demo products
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
docker run -d --name shopping_cart_test_db -e POSTGRES_PASSWORD=postgres -p 5433:5432 postgres:16-alpine
DATABASE_URL=postgres://postgres:postgres@localhost:5433/postgres npm run db:migrate
DATABASE_URL=postgres://postgres:postgres@localhost:5433/postgres npm run test:integration
```

## API reference

All responses are JSON. Errors use the shape `{ "error": { "code": "...", "message": "...", "details"?: ... } }` with status 400 (validation), 401 (not logged in), 403 (logged in, but wrong role or not the owner), 404 (not found), 409 (conflict, e.g. insufficient stock), or 500.

**Note on state-changing requests:** Astro's built-in CSRF protection (`security.checkOrigin`, on by default) rejects POST/PUT/DELETE requests whose `Origin` header doesn't match the request host. Browser `fetch` calls from the app's own UI satisfy this automatically. When testing with curl/Postman, add `-H "Origin: http://localhost:4321"`.

### Auth

Sessions are an httpOnly `sessionId` cookie backed by a server-side session table (not a JWT) — set automatically by register/login, cleared by logout.

| Method | Path                 | Body                        | Notes                                                      |
| ------ | -------------------- | --------------------------- | ---------------------------------------------------------- |
| POST   | `/api/auth/register` | `{ email, password, role }` | `role` is `"buyer"` or `"seller"`; 201, 409 if email taken |
| POST   | `/api/auth/login`    | `{ email, password }`       | 401 on wrong email/password                                |
| POST   | `/api/auth/logout`   | —                           | 204, clears the session                                    |
| GET    | `/api/auth/me`       | —                           | `{ user: UserDto \| null }`                                |

### Products

Fetching is public. Creating/updating/deleting requires a logged-in seller, and updates/deletes are further restricted to the product's own seller (enforced in the use case, not just the route).

| Method | Path                | Body                                                               | Notes                                                                |
| ------ | ------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| GET    | `/api/products`     | —                                                                  | Lists all products; `?vendorId=` filters to one seller               |
| POST   | `/api/products`     | `{ name, description?, priceInCents, stockQuantity }`              | Seller-only; 201; `vendorId` is taken from the session, not the body |
| GET    | `/api/products/:id` | —                                                                  | 404 if unknown                                                       |
| PUT    | `/api/products/:id` | Any subset of `{ name, description, priceInCents, stockQuantity }` | Owning seller only; 403 otherwise                                    |
| DELETE | `/api/products/:id` | —                                                                  | Owning seller only; 204; 403 otherwise                               |

### Cart

The cart is identified by an httpOnly `cartId` cookie, set automatically on first use — no login required.

| Method | Path                         | Body                      | Notes                                            |
| ------ | ---------------------------- | ------------------------- | ------------------------------------------------ |
| GET    | `/api/cart`                  | —                         | Returns (or creates) the caller's cart           |
| POST   | `/api/cart/items`            | `{ productId, quantity }` | 201, 404 unknown product, 409 insufficient stock |
| PUT    | `/api/cart/items/:productId` | `{ quantity }`            | Sets absolute quantity; 404/409 as above         |
| DELETE | `/api/cart/items/:productId` | —                         | Removes the line item                            |

## Project structure

```
src/
  domain/            # entities, value objects, domain events, repository interfaces — no I/O
    product/ cart/ identity/ shared/
  application/       # use cases (one per operation), DTOs — orchestrates the domain
    product/ cart/ identity/ shared/
  infrastructure/     # Drizzle schema/client, repository implementations, DI container
    db/ repositories/ auth/ di/
  lib/                # Zod schemas, HTTP helpers (error mapping, cookies, requireUser)
  middleware.ts        # resolves the session cookie into Astro.locals.user on every request
  env.d.ts             # App.Locals typing
  pages/
    api/               # REST endpoints (thin — validate, call a use case, map the result)
    index.astro        # product listing (read-only, public)
    cart.astro          # cart page
    login.astro register.astro
    sell/index.astro    # seller dashboard (redirects away if not a logged-in seller)
  components/           # Preact islands (AddToCartControl, CartView, CartBadge, LoginForm, RegisterForm, SellerProductManager)
tests/
  unit/                 # domain + application layer, fully isolated (in-memory fakes)
  integration/           # repositories and API routes against a real Postgres
drizzle/                # generated SQL migrations
```
