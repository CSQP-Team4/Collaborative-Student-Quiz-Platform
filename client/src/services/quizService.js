import api from '../api/api';

export const quizService = {
  async getQuiz(quizId) {
    const { data } = await api.get(`/quizzes/${quizId}`);
    return data;
  },

  async startAttempt(quizId, { resume = false } = {}) {
    const { data } = await api.post(`/quizzes/${quizId}/attempts`, { resume });
    return data;
  },

  async recordAntiCheatEvent(attemptId, { type, details = {} }) {
    const { data } = await api.post(`/attempts/${attemptId}/anti-cheat`, { type, details });
    return data;
  },

  async submitAttempt(attemptId, responses) {
    const { data } = await api.post(`/attempts/${attemptId}/submit`, { responses });
    return data;
  },
};

export default quizService;
