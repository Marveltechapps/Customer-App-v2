/**
 * Local delivery addresses for guest (logged-out) browsing.
 * Same Address shape as the API so UI can stay unchanged.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Address,
  CreateAddressPayload,
  UpdateAddressPayload,
} from './addressService';

const GUEST_ADDRESSES_KEY = '@selorg_guest_addresses';

function nowIso(): string {
  return new Date().toISOString();
}

function makeGuestId(): string {
  return `guest_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function isGuestAddressId(id: string | undefined | null): boolean {
  return typeof id === 'string' && id.startsWith('guest_');
}

async function readAll(): Promise<Address[]> {
  try {
    const raw = await AsyncStorage.getItem(GUEST_ADDRESSES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Address[]) : [];
  } catch {
    return [];
  }
}

async function writeAll(list: Address[]): Promise<void> {
  await AsyncStorage.setItem(GUEST_ADDRESSES_KEY, JSON.stringify(list));
}

export async function listGuestAddresses(): Promise<Address[]> {
  return readAll();
}

export async function createGuestAddress(data: CreateAddressPayload): Promise<Address> {
  const list = await readAll();
  const makeDefault = data.isDefault === true || list.length === 0;
  const created: Address = {
    _id: makeGuestId(),
    userId: 'guest',
    label: data.label,
    line1: data.line1,
    line2: data.line2 ?? '',
    landmark: data.landmark ?? '',
    city: data.city,
    state: data.state ?? '',
    pincode: data.pincode ?? '',
    latitude: data.latitude,
    longitude: data.longitude,
    isDefault: makeDefault,
    order: list.length,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  const next = makeDefault
    ? [...list.map((a) => ({ ...a, isDefault: false })), created]
    : [...list, created];

  await writeAll(next);
  return created;
}

export async function updateGuestAddress(
  id: string,
  data: UpdateAddressPayload,
): Promise<Address | null> {
  const list = await readAll();
  const idx = list.findIndex((a) => a._id === id);
  if (idx < 0) return null;

  const prev = list[idx];
  const updated: Address = {
    ...prev,
    label: data.label ?? prev.label,
    line1: data.line1 ?? prev.line1,
    line2: data.line2 ?? prev.line2,
    landmark: data.landmark ?? prev.landmark,
    city: data.city ?? prev.city,
    state: data.state ?? prev.state,
    pincode: data.pincode ?? prev.pincode,
    latitude: data.latitude ?? prev.latitude,
    longitude: data.longitude ?? prev.longitude,
    isDefault: data.isDefault ?? prev.isDefault,
    updatedAt: nowIso(),
  };

  let next = [...list];
  next[idx] = updated;
  if (updated.isDefault) {
    next = next.map((a) => ({ ...a, isDefault: a._id === id }));
  }
  await writeAll(next);
  return updated;
}

export async function deleteGuestAddress(id: string): Promise<boolean> {
  const list = await readAll();
  const next = list.filter((a) => a._id !== id);
  if (next.length === list.length) return false;

  if (next.length > 0 && !next.some((a) => a.isDefault)) {
    next[0] = { ...next[0], isDefault: true, updatedAt: nowIso() };
  }
  await writeAll(next);
  return true;
}

export async function setGuestDefaultAddress(id: string): Promise<Address | null> {
  const list = await readAll();
  if (!list.some((a) => a._id === id)) return null;
  const next = list.map((a) => ({
    ...a,
    isDefault: a._id === id,
    updatedAt: a._id === id ? nowIso() : a.updatedAt,
  }));
  await writeAll(next);
  return next.find((a) => a._id === id) ?? null;
}

export async function getGuestDefaultAddress(): Promise<Address | null> {
  const list = await readAll();
  return list.find((a) => a.isDefault) ?? list[0] ?? null;
}

export async function clearGuestAddresses(): Promise<void> {
  await AsyncStorage.removeItem(GUEST_ADDRESSES_KEY);
}
