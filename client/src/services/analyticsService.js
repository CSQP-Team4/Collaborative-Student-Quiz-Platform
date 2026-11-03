import api from '../api/api';

function filenameFrom(disposition, fallback) {
  const match = /filename="?([^";]+)"?/i.exec(disposition || '');
  return match ? match[1] : fallback;
}

// CSQP-30 / CSQP-F-043: download a report file (PDF or CSV).
async function download(url, format, fallbackName) {
  const res = await api.get(url, { params: { format }, responseType: 'blob' });
  return {
    blob: res.data,
    filename: filenameFrom(res.headers?.['content-disposition'], `${fallbackName}.${format}`),
  };
}

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

  exportMyPerformance(format) {
    return download('/analytics/me/export', format, 'csqp-my-progress');
  },

  exportClassAnalytics(format) {
    return download('/analytics/class/export', format, 'csqp-class-analytics');
  },
};

export default analyticsService;
