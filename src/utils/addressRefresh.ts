/**
 * Pub/sub with address payloads for instant UI after the server has already persisted.
 *
 * Call `notifyAddressesChanged` only after a successful create/update/delete API response
 * (use `res.data` from the server). Do not notify on failure — MongoDB is unchanged then.
 */
import type { Address } from '../services/address/addressService';

export type AddressChangeEvent =
  | { type: 'upsert'; address: Address }
  | { type: 'delete'; addressId: string; nextAddress?: Address | null };

type AddressRefreshListener = (event: AddressChangeEvent) => void;

const listeners = new Set<AddressRefreshListener>();

export function subscribeAddressesChanged(listener: AddressRefreshListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyAddressesChanged(event: AddressChangeEvent): void {
  listeners.forEach((listener) => {
    try {
      listener(event);
    } catch {
      // ignore subscriber errors
    }
  });
}
