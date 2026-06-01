import { api } from '../api/client';
import { endpoints } from '../api/endpoints';
import type { ApiResponse } from '../api/types';

export interface SavedCard {
  id: string;
  type: 'card' | 'upi' | 'wallet';
  last4: string;
  brand: string;
  cardholderName: string;
  expiryMonth: string;
  expiryYear: string;
  upiId: string;
  walletName: string;
  isDefault: boolean;
}

export interface AddCardRequest {
  type: 'card';
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cardholderName: string;
}

export interface UpdateCardRequest {
  cardNumber?: string;
  expiryMonth?: string;
  expiryYear?: string;
  cardholderName?: string;
}

export const paymentService = {
  getSavedMethods: (): Promise<ApiResponse<SavedCard[]>> => {
    return api.get<SavedCard[]>(endpoints.payments.methods);
  },

  addMethod: (data: AddCardRequest): Promise<ApiResponse<SavedCard>> => {
    return api.post<SavedCard>(endpoints.payments.addMethod, data);
  },

  updateMethod: (id: string, data: UpdateCardRequest): Promise<ApiResponse<SavedCard>> => {
    return api.put<SavedCard>(`${endpoints.payments.methods}/${id}`, data);
  },

  removeMethod: (id: string): Promise<ApiResponse<void>> => {
    return api.delete<void>(endpoints.payments.removeMethod(id));
  },

  setDefault: (id: string): Promise<ApiResponse<SavedCard>> => {
    return api.post<SavedCard>(endpoints.payments.setDefault(id));
  },
};
