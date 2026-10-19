// Tailwind classes rather than inline colours, so pages need no inline style
// attributes (blocked by the Content-Security-Policy).
const PALETTE = [
  'bg-blue-100',
  'bg-amber-100',
  'bg-green-100',
  'bg-fuchsia-100',
  'bg-rose-100',
  'bg-indigo-100',
  'bg-yellow-100',
  'bg-teal-100',
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * There's no product image upload in scope, so listings show a deterministic
 * pastel tile + initial instead of a broken <img> or an external placeholder
 * service (which would add a network dependency for a purely cosmetic need).
 */
export function placeholderTile(seed: string): { className: string; glyph: string } {
  const hash = hashString(seed);
  return {
    className: PALETTE[hash % PALETTE.length],
    glyph: seed.trim().charAt(0).toUpperCase() || '?',
  };
}
