/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    user: import('./application/identity/UserDto').UserDto | null;
  }
}
