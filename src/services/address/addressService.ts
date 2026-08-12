import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { ApiResponse, RequestConfig } from '../api/types';
import { tokenManager } from '../api/tokenManager';
import {
  createGuestAddress,
  deleteGuestAddress,
  getGuestDefaultAddress,
  listGuestAddresses,
  setGuestDefaultAddress,
  updateGuestAddress,
} from './guestAddressStorage';

/** Bypass HTTP caches (CDN/proxy) and backend response cache for address reads. */
function freshAddressGetConfig(): RequestConfig {
  return {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      Pragma: 'no-cache',
    },
    params: { _: Date.now() },
  };
}

export interface Address {
  _id: string;
  userId: string;
  label: string;
  line1: string;
  line2: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAddressPayload {
  label: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

export interface UpdateAddressPayload {
  label?: string;
  line1?: string;
  line2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

function isGuestSession(): boolean {
  return !tokenManager.isTokenValid();
}

/**
 * Address CRUD — authenticated users hit the API; guests use local storage
 * so delivery location can be selected without login.
 */
export const addressService = {
  getAll: async (): Promise<ApiResponse<Address[]>> => {
    if (isGuestSession()) {
      const data = await listGuestAddresses();
      return { success: true, data };
    }
    return api.get<Address[]>(endpoints.addresses.list, freshAddressGetConfig());
  },

  getDefault: async (): Promise<ApiResponse<Address | null>> => {
    if (isGuestSession()) {
      const data = await getGuestDefaultAddress();
      return { success: true, data };
    }
    return api.get<Address | null>(endpoints.addresses.default, freshAddressGetConfig());
  },

  create: async (data: CreateAddressPayload): Promise<ApiResponse<Address>> => {
    if (isGuestSession()) {
      const created = await createGuestAddress(data);
      return { success: true, data: created };
    }
    return api.post<Address>(endpoints.addresses.create, data);
  },

  update: async (id: string, data: UpdateAddressPayload): Promise<ApiResponse<Address>> => {
    if (isGuestSession()) {
      const updated = await updateGuestAddress(id, data);
      if (!updated) {
        return { success: false, message: 'Address not found' };
      }
      return { success: true, data: updated };
    }
    return api.put<Address>(endpoints.addresses.update(id), data);
  },

  delete: async (id: string): Promise<ApiResponse<void>> => {
    if (isGuestSession()) {
      const ok = await deleteGuestAddress(id);
      return { success: ok, message: ok ? undefined : 'Address not found' };
    }
    return api.delete<void>(endpoints.addresses.delete(id));
  },

  setDefault: async (id: string): Promise<ApiResponse<Address>> => {
    if (isGuestSession()) {
      const updated = await setGuestDefaultAddress(id);
      if (!updated) {
        return { success: false, message: 'Address not found' };
      }
      return { success: true, data: updated };
    }
    return api.post<Address>(endpoints.addresses.setDefault(id));
  },
};

export default addressService;
