# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Public hostname(s) the app is served on — baked into the build (see astro.config.mjs).
ARG ALLOWED_HOSTS=""
ENV ALLOWED_HOSTS=$ALLOWED_HOSTS
# Builds the Astro server and bundles the migrate/seed scripts into dist/scripts,
# so the runtime image needs neither tsx nor the TypeScript sources.
RUN npm run build

FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM base AS runtime
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --chown=node:node package.json ./package.json

USER node

EXPOSE 4321

CMD ["node", "./dist/server/entry.mjs"]
