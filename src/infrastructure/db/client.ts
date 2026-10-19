import postgres from 'postgres';
import { drizzle, type PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import * as schema from './schema';

function resolveConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  return url;
}

export const sql = postgres(resolveConnectionString());

export const db = drizzle(sql, { schema });

/**
 * The query surface shared by `db` and a transaction handle, so repositories
 * can be constructed on either — see DrizzleUnitOfWork.
 */
export type Database = PgDatabase<PostgresJsQueryResultHKT, typeof schema>;
