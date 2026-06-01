/**
 * Location Service
 * Handles address/location-related API calls
 */

import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { ApiResponse } from '../api/types';

export interface Address {
  id: string;
  type: 'home' | 'work' | 'other';
  name: string;
  phoneNumber: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  isDefault: boolean;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface CreateAddressRequest {
  type: Address['type'];
  name: string;
  phoneNumber: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  landmark?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface UpdateAddressRequest extends Partial<CreateAddressRequest> {
  id: string;
}

/**
 * Get list of addresses
 */
export const getAddresses = async (): Promise<ApiResponse<Address[]>> => {
  return api.get<Address[]>(endpoints.addresses.list);
};

/**
 * Create new address
 */
export const createAddress = async (data: CreateAddressRequest): Promise<ApiResponse<Address>> => {
  return api.post<Address>(endpoints.addresses.create, data);
};

/**
 * Update address
 */
export const updateAddress = async (data: UpdateAddressRequest): Promise<ApiResponse<Address>> => {
  const { id, ...updateData } = data;
  return api.put<Address>(endpoints.addresses.update(id), updateData);
};

/**
 * Delete address
 */
export const deleteAddress = async (id: string): Promise<ApiResponse<void>> => {
  return api.delete<void>(endpoints.addresses.delete(id));
};

/**
 * Set default address
 */
export const setDefaultAddress = async (id: string): Promise<ApiResponse<Address>> => {
  return api.post<Address>(endpoints.addresses.setDefault(id));
};

