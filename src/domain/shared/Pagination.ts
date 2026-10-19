export interface PageRequest {
  limit: number;
  offset: number;
}

export interface Page<T> {
  items: T[];
  /** Total matching rows across all pages. */
  total: number;
}
