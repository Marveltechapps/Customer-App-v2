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
  phoneVerified?: boolean;
  phoneVerifiedAt?: string;
  avatar?: string;
  avatarUrl?: string;
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
  avatarUrl?: string;
  savedCheckoutContact?: SavedCheckoutContact;
}

export interface LinkPhoneOtpResult {
  sessionId: string;
  channel?: string;
  resendCooldownSeconds?: number;
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
 * Upload avatar as base64 (no data: prefix). Returns updated public profile.
 */
export const uploadAvatar = async (base64Image: string): Promise<ApiResponse<UserProfile>> => {
  const image = base64Image.includes(',')
    ? base64Image.split(',').pop() || base64Image
    : base64Image;
  return api.post<UserProfile>(endpoints.user.avatar, { image });
};

/** Send OTP to link a phone number on the authenticated profile. */
export const sendLinkPhoneOtp = async (
  phoneNumber: string,
  channel: 'sms' | 'whatsapp' = 'sms'
): Promise<ApiResponse<LinkPhoneOtpResult> & LinkPhoneOtpResult> => {
  const digits = String(phoneNumber || '').replace(/\D/g, '').slice(-10);
  return api.post(endpoints.user.sendLinkPhoneOtp, {
    phoneNumber: digits,
    channel,
    preferredChannel: channel,
  });
};

/** Verify OTP and permanently link phone to the authenticated profile. */
export const verifyLinkPhoneOtp = async (
  sessionId: string,
  otp: string
): Promise<ApiResponse<UserProfile>> => {
  return api.post(endpoints.user.verifyLinkPhoneOtp, { sessionId, otp });
};

export const resendLinkPhoneOtp = async (
  sessionId: string
): Promise<ApiResponse<{ resendCooldownSeconds?: number; channel?: string }>> => {
  return api.post(endpoints.user.resendLinkPhoneOtp, { sessionId });
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
