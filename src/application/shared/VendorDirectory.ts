/** Read-side lookup of how sellers are shown to shoppers. */
export interface VendorDirectory {
  /** Display name per vendor id; ids with no seller account are left out. */
  displayNames(vendorIds: readonly string[]): Promise<Map<string, string>>;
}

export const FALLBACK_VENDOR_NAME = 'MediKart seller';

/** Company name if the seller set one, else their name, else a neutral fallback. */
export function vendorDisplayName(profile: {
  companyName: string | null;
  name: string | null;
}): string {
  return profile.companyName?.trim() || profile.name?.trim() || FALLBACK_VENDOR_NAME;
}

export function nameFor(names: Map<string, string>, vendorId: string): string {
  return names.get(vendorId) ?? FALLBACK_VENDOR_NAME;
}
