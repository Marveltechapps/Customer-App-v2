import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { ApiResponse, RequestConfig } from '../api/types';

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

export const addressService = {
  getAll: async (): Promise<ApiResponse<Address[]>> => {
    return api.get<Address[]>(endpoints.addresses.list, freshAddressGetConfig());
  },

  getDefault: async (): Promise<ApiResponse<Address | null>> => {
    return api.get<Address | null>(endpoints.addresses.default, freshAddressGetConfig());
  },

  create: async (data: CreateAddressPayload): Promise<ApiResponse<Address>> => {
    return api.post<Address>(endpoints.addresses.create, data);
  },

  update: async (id: string, data: UpdateAddressPayload): Promise<ApiResponse<Address>> => {
    return api.put<Address>(endpoints.addresses.update(id), data);
  },

  delete: async (id: string): Promise<ApiResponse<void>> => {
    return api.delete<void>(endpoints.addresses.delete(id));
  },

  setDefault: async (id: string): Promise<ApiResponse<Address>> => {
    return api.post<Address>(endpoints.addresses.setDefault(id));
  },
};

export default addressService;
