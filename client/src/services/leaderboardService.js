import api from '../api/api';

// CSQP-29 / CSQP-F-042: opt-in leaderboard.
export const leaderboardService = {
  async getLeaderboard({ scope = 'quiz', id } = {}) {
    const { data } = await api.get('/leaderboard', { params: { scope, ...(id ? { id } : {}) } });
    return data;
  },

  async getSettings() {
    const { data } = await api.get('/leaderboard/settings');
    return data.optIn;
  },

  async updateSettings(optIn) {
    const { data } = await api.put('/leaderboard/settings', { optIn });
    return data;
  },
};

export default leaderboardService;
