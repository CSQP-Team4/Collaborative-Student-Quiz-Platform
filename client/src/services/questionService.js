import api from '../api/api';

export const questionService = {
  async listQuestions(params = {}) {
    const { data } = await api.get('/questions', { params });
    return data.questions;
  },

  async importQuestions(formData) {
    const { data } = await api.post('/questions/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return data;
  },

  getExportUrl(format = 'csv') {
    return `/api/questions/export?format=${format}`;
  },
};

export default questionService;
