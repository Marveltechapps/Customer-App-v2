/**
 * Profile Service
 * Handles user profile-related API calls
 */

import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { ApiResponse } from '../api/types';

export interface UserProfile {
  id: string;
  name: string;
  email?: string;
  phoneNumber: string;
  avatar?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
}

/** Persisted from checkout when the user opts in to reuse details */
export interface SavedCheckoutContact {
  fullName?: string;
  email?: string;
  phone?: string;
}

export interface UpdateProfileRequest {
  name?: string;
  email?: string;
  dateOfBirth?: string;
  gender?: UserProfile['gender'];
  avatar?: string;
  savedCheckoutContact?: SavedCheckoutContact;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'upi' | 'wallet';
  last4?: string;
  upiId?: string;
  walletName?: string;
  isDefault: boolean;
}

export interface AddPaymentMethodRequest {
  type: PaymentMethod['type'];
  cardNumber?: string;
  expiryMonth?: string;
  expiryYear?: string;
  cvv?: string;
  upiId?: string;
  walletName?: string;
}

/**
 * Get user profile
 */
export const getProfile = async (): Promise<ApiResponse<UserProfile>> => {
  return api.get<UserProfile>(endpoints.user.profile);
};

/**
 * Update user profile
 */
export const updateProfile = async (data: UpdateProfileRequest): Promise<ApiResponse<UserProfile>> => {
  return api.put<UserProfile>(endpoints.user.updateProfile, data);
};

/**
 * Get payment methods
 */
export const getPaymentMethods = async (): Promise<ApiResponse<PaymentMethod[]>> => {
  return api.get<PaymentMethod[]>(endpoints.payments.methods);
};

/**
 * Add payment method
 */
export const addPaymentMethod = async (data: AddPaymentMethodRequest): Promise<ApiResponse<PaymentMethod>> => {
  return api.post<PaymentMethod>(endpoints.payments.addMethod, data);
};

/**
 * Remove payment method
 */
export const removePaymentMethod = async (id: string): Promise<ApiResponse<void>> => {
  return api.delete<void>(endpoints.payments.removeMethod(id));
};

/**
 * Set default payment method
 */
export const setDefaultPaymentMethod = async (id: string): Promise<ApiResponse<PaymentMethod>> => {
  return api.post<PaymentMethod>(endpoints.payments.setDefault(id));
};

