import { apiClient } from '../api/client';

export interface AssignStoreResponse {
  serviceable: boolean;
  store?: {
    id: string;
    name: string;
    code: string;
    distanceKm: number;
    avgPickPackTime: number;
    operatingHours: { open: string; close: string };
  };
  error?: string;
}

export const storeService = {
  async assignStore(latitude: number, longitude: number): Promise<AssignStoreResponse> {
    try {
      const response = await apiClient.post('/store/assign', { latitude, longitude });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { serviceable: false, error: error.response.data?.error };
      }
      throw error;
    }
  },

  async getStoreInventory(storeId: string, page = 1, limit = 50) {
    const response = await apiClient.get(`/store/${storeId}/inventory`, {
      params: { page, limit },
    });
    return response.data;
  },
};
