import api from '../api/api';

// CSQP-27 / CSQP-F-040: performance data computed by the Python analytics service.
export const analyticsService = {
  async getMyPerformance() {
    const { data } = await api.get('/analytics/me');
    return data.summary;
  },
};

export default analyticsService;
