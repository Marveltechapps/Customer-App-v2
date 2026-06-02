import type { Address } from '../services/address/addressService';
import type { LocationData } from '../contexts/LocationContext';

export function formatAddressLines(
  addr: Pick<Address, 'line1' | 'line2' | 'landmark' | 'city' | 'state' | 'pincode'> | null | undefined,
): string {
  if (!addr) return '';
  const parts = [addr.line1, addr.line2, addr.landmark, addr.city, addr.state, addr.pincode].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : '';
}

export function pickDefaultAddress(addresses: Address[]): Address | null {
  if (!addresses.length) return null;
  return addresses.find((a) => a.isDefault) ?? addresses[0];
}

export function addressToLocationData(address: Address): LocationData {
  return {
    latitude: address.latitude ?? 0,
    longitude: address.longitude ?? 0,
    address: formatAddressLines(address),
    area: address.city || '',
    city: address.city || '',
    granted: true,
  };
}

/** Patch a saved-address list after create/update (marks single default). */
export function mergeUpsertAddressList(list: Address[], address: Address): Address[] {
  const idx = list.findIndex((a) => a._id === address._id);
  const next = idx >= 0 ? [...list] : [...list, address];
  if (idx >= 0) {
    next[idx] = address;
  }
  if (address.isDefault) {
    return next.map((a) => ({ ...a, isDefault: a._id === address._id }));
  }
  return next;
}

export function removeAddressFromList(list: Address[], addressId: string): Address[] {
  return list.filter((a) => a._id !== addressId);
}

/** Which address the home header should show after an upsert event. */
export function resolveHomeDefaultAfterUpsert(prev: Address | null, updated: Address): Address {
  if (updated.isDefault) return updated;
  if (!prev) return updated;
  if (prev._id === updated._id) return updated;
  return prev;
}

export function shouldCheckoutShowAddress(
  preferredId: string | undefined,
  updated: Address,
): boolean {
  if (!preferredId) return true;
  if (preferredId === updated._id) return true;
  return Boolean(updated.isDefault);
}
