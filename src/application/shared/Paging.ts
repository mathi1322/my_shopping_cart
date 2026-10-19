import type { PageRequest } from '../../domain/shared/Pagination';

export interface PageQuery {
  page?: number;
  pageSize?: number;
}

export interface Paged {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Clamps a requested page to sane bounds and converts it to a repository limit/offset. */
export function resolvePage(
  query: PageQuery,
  defaults: { pageSize: number; maxPageSize: number },
): { page: number; pageSize: number; request: PageRequest } {
  const pageSize = Math.min(
    Math.max(Math.trunc(query.pageSize ?? defaults.pageSize) || defaults.pageSize, 1),
    defaults.maxPageSize,
  );
  const page = Math.max(Math.trunc(query.page ?? 1) || 1, 1);
  return { page, pageSize, request: { limit: pageSize, offset: (page - 1) * pageSize } };
}

export function pageInfo(total: number, page: number, pageSize: number): Paged {
  return { total, page, pageSize, totalPages: Math.max(Math.ceil(total / pageSize), 1) };
}
