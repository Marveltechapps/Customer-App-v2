import { api } from '../api/client';
import { endpoints } from '../api/endpoints';

export const userService = {
  getProfile: async () => {
    return api.get(endpoints.user.profile);
  },
};

export default userService;

