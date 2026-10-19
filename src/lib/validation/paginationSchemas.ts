import { z } from 'zod';

/** ?page=&pageSize= from a URL; bounds are clamped by the use case. */
export const pageQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  pageSize: z.coerce.number().int().positive().optional(),
});

export function pageQueryFrom(url: URL) {
  return pageQuerySchema.parse({
    page: url.searchParams.get('page') ?? undefined,
    pageSize: url.searchParams.get('pageSize') ?? undefined,
  });
}
