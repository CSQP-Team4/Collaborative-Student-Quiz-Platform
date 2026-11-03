import api from '../api/api';

export const userService = {
  async getProfile() {
    const { data } = await api.get('/users/profile');
    return data.user;
  },

  async updateProfile(updates) {
    const { data } = await api.put('/users/profile', updates);
    return data;
  },

  async changePassword({ currentPassword, newPassword }) {
    const { data } = await api.put('/users/change-password', {
      currentPassword,
      newPassword,
    });
    return data;
  },

  async getUsers() {
    const { data } = await api.get('/users');
    return data.users;
  },

  async updateUserRole(userId, role) {
    const { data } = await api.put(`/users/${userId}/role`, { role });
    return data;
  },
};

export default userService;
