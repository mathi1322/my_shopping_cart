import type { VendorDirectory } from '@/application/shared/VendorDirectory';

export class InMemoryVendorDirectory implements VendorDirectory {
  private readonly names = new Map<string, string>();

  set(vendorId: string, displayName: string): void {
    this.names.set(vendorId, displayName);
  }

  async displayNames(vendorIds: readonly string[]): Promise<Map<string, string>> {
    return new Map(
      vendorIds.filter((id) => this.names.has(id)).map((id) => [id, this.names.get(id)!]),
    );
  }
}
