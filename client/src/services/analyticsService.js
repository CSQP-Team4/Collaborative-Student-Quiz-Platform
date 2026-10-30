import api from '../api/api';

// CSQP-27 / CSQP-F-040: performance data computed by the Python analytics service.
export const analyticsService = {
  async getMyPerformance() {
    const { data } = await api.get('/analytics/me');
    return data.summary;
  },

  // CSQP-28 / CSQP-F-041: per-quiz class analytics for instructors.
  async getClassAnalytics() {
    const { data } = await api.get('/analytics/class');
    return data.summary;
  },
};

export default analyticsService;
