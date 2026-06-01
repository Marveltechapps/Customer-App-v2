import { api } from '../api/client';
import { endpoints } from '../api/endpoints';

export const homeService = {
  getHomePayload: async () => api.get(endpoints.home.payload),
  getBootstrap: async () => api.get(endpoints.bootstrap),
};

export default homeService;

