import api from '../api/api';

// CSQP-35 / CSQP-NF-002: uptime report and planned maintenance (admins).
export const opsService = {
  async getUptimeReport(months = 3) {
    const { data } = await api.get('/ops/uptime', { params: { months } });
    return data;
  },

  async scheduleMaintenance({ start, end, reason }) {
    const { data } = await api.post('/ops/maintenance', { start, end, reason });
    return data.maintenance;
  },
};

export default opsService;
