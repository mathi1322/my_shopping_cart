import { inArray } from 'drizzle-orm';
import type { Database } from '../db/client';
import { users } from '../db/schema';
import { vendorDisplayName, type VendorDirectory } from '../../application/shared/VendorDirectory';

export class DrizzleVendorDirectory implements VendorDirectory {
  constructor(private readonly db: Database) {}

  async displayNames(vendorIds: readonly string[]): Promise<Map<string, string>> {
    const unique = [...new Set(vendorIds)];
    if (unique.length === 0) {
      return new Map();
    }
    const rows = await this.db
      .select({ id: users.id, name: users.name, companyName: users.companyName })
      .from(users)
      .where(inArray(users.id, unique));
    return new Map(rows.map((row) => [row.id, vendorDisplayName(row)]));
  }
}
