// @ts-check
import process from 'node:process';
import { defineConfig } from 'astro/config';

import node from '@astrojs/node';
import preact from '@astrojs/preact';
import tailwindcss from '@tailwindcss/vite';

// Astro only trusts the Host / X-Forwarded-* headers for these hosts; for any
// other host it falls back to localhost:<PORT>, which breaks the same-origin
// (CSRF) check and hides real client IPs. Set public hostnames at build time,
// e.g. ALLOWED_HOSTS=shop.example.com,www.shop.example.com. When unset (local
// dev / the Docker demo), localhost on any port is trusted instead. Trusting a
// host also means trusting X-Forwarded-For, so in production only expose the
// app through a reverse proxy that overwrites that header.
const allowedHosts = (process.env.ALLOWED_HOSTS ?? '')
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);
const trustedHostnames = allowedHosts.length > 0 ? allowedHosts : ['localhost', '127.0.0.1'];

// https://astro.build/config
export default defineConfig({
  output: 'server',

  security: {
    allowedDomains: trustedHostnames.map((hostname) => ({ hostname })),
  },

  adapter: node({
    mode: 'standalone',
  }),

  integrations: [preact()],

  vite: {
    plugins: [tailwindcss()],
  },
});
