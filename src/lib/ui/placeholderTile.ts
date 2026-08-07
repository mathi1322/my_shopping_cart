const PALETTE = [
  '#dbeafe',
  '#fef3c7',
  '#dcfce7',
  '#fae8ff',
  '#ffe4e6',
  '#e0e7ff',
  '#fef9c3',
  '#ccfbf1',
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
export function placeholderTile(seed: string): { background: string; glyph: string } {
  const hash = hashString(seed);
  return {
    background: PALETTE[hash % PALETTE.length],
    glyph: seed.trim().charAt(0).toUpperCase() || '?',
  };
}
