import api from '../api/api';

// CSQP-13 & CSQP-14: Study materials upload, search and filter service
export const materialService = {
  async listMaterials(params = {}) {
    const { data } = await api.get('/materials', { params });
    return data.materials || [];
  },

  async uploadMaterial(formData) {
    const { data } = await api.post('/materials/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.material;
  },

  async getMaterial(id) {
    const { data } = await api.get(`/materials/${id}`);
    return data.material;
  },

  async downloadFile(fileUrl, filename) {
    const res = await api.get(fileUrl, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename || 'study-notes.pdf');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export default materialService;
