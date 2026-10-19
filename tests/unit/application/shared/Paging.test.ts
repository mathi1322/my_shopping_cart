import { describe, expect, it } from 'vitest';
import { pageInfo, resolvePage } from '@/application/shared/Paging';

const defaults = { pageSize: 10, maxPageSize: 50 };

describe('resolvePage', () => {
  it('converts page and page size to limit/offset', () => {
    expect(resolvePage({ page: 3, pageSize: 20 }, defaults)).toEqual({
      page: 3,
      pageSize: 20,
      request: { limit: 20, offset: 40 },
    });
  });

  it('uses defaults and clamps nonsense values', () => {
    expect(resolvePage({}, defaults).request).toEqual({ limit: 10, offset: 0 });
    expect(resolvePage({ page: 0, pageSize: 0 }, defaults)).toMatchObject({
      page: 1,
      pageSize: 10,
    });
    expect(resolvePage({ page: -2, pageSize: 999 }, defaults)).toMatchObject({
      page: 1,
      pageSize: 50,
    });
    expect(resolvePage({ page: 2.7 }, defaults).page).toBe(2);
  });
});

describe('pageInfo', () => {
  it('always reports at least one page', () => {
    expect(pageInfo(0, 1, 10).totalPages).toBe(1);
    expect(pageInfo(21, 1, 10).totalPages).toBe(3);
  });
});
