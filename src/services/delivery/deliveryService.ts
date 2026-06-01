import { apiClient } from '../api/client';

export interface DeliveryEstimate {
  estimatedMinutes: number;
  promiseText: string;
  breakdown: {
    pickPackTime: number;
    travelTime: number;
    bufferTime: number;
    itemBonus: number;
    distanceKm: number;
  };
}

export interface DeliveryFeeResponse {
  deliveryFee: number;
  surgeCharge: number;
  handlingCharge: number;
  freeDeliveryThreshold: number;
  distanceKm: number;
}

export const deliveryService = {
  async getEstimate(storeId: string, latitude: number, longitude: number, cartItemCount: number): Promise<DeliveryEstimate> {
    const response = await apiClient.get('/delivery/estimate', {
      params: { storeId, latitude, longitude, cartItemCount },
    });
    return response.data;
  },

  async getFee(storeId: string, latitude: number, longitude: number, orderTotal: number): Promise<DeliveryFeeResponse> {
    const response = await apiClient.get('/delivery/fee', {
      params: { storeId, latitude, longitude, orderTotal },
    });
    return response.data;
  },
};
