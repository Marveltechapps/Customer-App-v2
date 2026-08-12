/**
 * Migrate guest delivery addresses + location into the authenticated account.
 * Called once after OTP success, before post-auth navigation.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { Address, CreateAddressPayload } from './addressService';
import {
  clearGuestAddresses,
  listGuestAddresses,
} from './guestAddressStorage';
import { logger } from '@/utils/logger';

const LOCATION_KEY = '@selorg_user_location';
const STORE_KEY = '@selorg_assigned_store';
const GUEST_KEY = 'guest';

function locationKeyFor(userKey: string) {
  return `${LOCATION_KEY}:${userKey}`;
}

function storeKeyFor(userKey: string) {
  return `${STORE_KEY}:${userKey}`;
}

async function createRemoteAddress(data: CreateAddressPayload): Promise<Address | null> {
  try {
    const res = await api.post<Address>(endpoints.addresses.create, data);
    if (res?.success && res.data) return res.data;
  } catch (err) {
    logger.warn('Failed to migrate guest address to account', err);
  }
  return null;
}

async function listRemoteAddresses(): Promise<Address[]> {
  try {
    const res = await api.get<Address[]>(endpoints.addresses.list, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache',
      },
      params: { _: Date.now() },
    });
    if (res?.success && Array.isArray(res.data)) return res.data;
  } catch (err) {
    logger.warn('Failed to list addresses during guest migration', err);
  }
  return [];
}

/**
 * Copy guest location/store buckets into the authenticated user's buckets
 * when the user bucket is empty.
 */
export async function migrateGuestLocationBucket(userKey: string): Promise<void> {
  if (!userKey || userKey === GUEST_KEY) return;
  try {
    const userLoc = await AsyncStorage.getItem(locationKeyFor(userKey));
    if (userLoc) return;

    const guestLoc = await AsyncStorage.getItem(locationKeyFor(GUEST_KEY));
    if (!guestLoc) return;

    await AsyncStorage.setItem(locationKeyFor(userKey), guestLoc);
    const guestStore = await AsyncStorage.getItem(storeKeyFor(GUEST_KEY));
    if (guestStore) {
      await AsyncStorage.setItem(storeKeyFor(userKey), guestStore);
    }
  } catch (err) {
    logger.warn('Failed to migrate guest location bucket', err);
  }
}

/**
 * Upload guest-saved addresses to the account (when account has none, or always
 * upload guest defaults that don't already exist). Clears local guest addresses after.
 */
export async function migrateGuestAddressesOnLogin(
  userKey?: string,
): Promise<{ hasAddresses: boolean }> {
  if (userKey) {
    await migrateGuestLocationBucket(userKey);
  }

  const guests = await listGuestAddresses();
  let remote = await listRemoteAddresses();

  if (guests.length > 0) {
    // Prefer migrating when the account has no addresses; otherwise still migrate
    // guest entries so delivery selection made before login is not lost.
    const shouldMigrate = remote.length === 0 || guests.some((g) => g.isDefault);
    if (shouldMigrate) {
      const toCreate = remote.length === 0 ? guests : guests.filter((g) => g.isDefault);
      for (const g of toCreate) {
        const created = await createRemoteAddress({
          label: g.label,
          line1: g.line1,
          line2: g.line2 || undefined,
          landmark: g.landmark || undefined,
          city: g.city,
          state: g.state || undefined,
          pincode: g.pincode || undefined,
          latitude: g.latitude,
          longitude: g.longitude,
          isDefault: g.isDefault || remote.length === 0,
        });
        if (created) {
          remote = [...remote.filter((a) => a._id !== created._id), created];
        }
      }
    }
    await clearGuestAddresses();
  }

  // Guest location was copied into the user bucket (LocationContext / migrateGuestLocationBucket).
  try {
    await AsyncStorage.multiRemove([locationKeyFor(GUEST_KEY), storeKeyFor(GUEST_KEY)]);
  } catch {
    // non-critical
  }

  // Re-read after creates
  if (remote.length === 0) {
    remote = await listRemoteAddresses();
  }

  return { hasAddresses: remote.length > 0 };
}
