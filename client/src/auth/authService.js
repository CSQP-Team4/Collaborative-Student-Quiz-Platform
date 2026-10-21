// Calls the Express auth API (built by CSQP-7, CSQP-8, CSQP-9).
// Contract follows SAD 4.3; endpoints not listed there are noted below so
// the backend can match them.
//
//   POST /api/auth/register             { name, email, password }  -> 201 { message }
//   POST /api/auth/verify-email         { email, code } | { token } -> 200 { message }
//   POST /api/auth/resend-verification  { email }                   -> 200 { message }
//   POST /api/auth/login                { email, password }         -> 200 { accessToken, user }   (SAD 4.3)
//   POST /api/auth/refresh              (HttpOnly cookie)           -> 200 { accessToken, user }   (SR-003)
//   POST /api/auth/logout               (HttpOnly cookie)           -> 204
//
// user = { id, name, email, role: "student" | "instructor" | "admin" }

import api from '../api/api';
import mockAuthService from './mockAuthService';

export const httpAuthService = {
  async register({ name, email, password }) {
    const { data } = await api.post('/auth/register', { name, email, password });
    return data;
  },
  async verifyEmail(payload) {
    const { data } = await api.post('/auth/verify-email', payload);
    return data;
  },
  async resendVerification({ email }) {
    const { data } = await api.post('/auth/resend-verification', { email });
    return data;
  },
  async login({ email, password }) {
    const { data } = await api.post('/auth/login', { email, password });
    return data;
  },
  async refresh() {
    const { data } = await api.post('/auth/refresh');
    return data;
  },
  async logout() {
    await api.post('/auth/logout');
  },
};

// Set VITE_USE_MOCK_AUTH=true to try the UI before the backend auth exists.
const useMock = import.meta.env.VITE_USE_MOCK_AUTH === 'true';

export const authService = useMock ? mockAuthService : httpAuthService;
export const isMockAuth = useMock;

// Turns an API error into a message for the user. Uses the standard error
// envelope from SAD 4.4: { success, statusCode, error, message, timestamp }.
export function getAuthErrorMessage(error, context = 'login') {
  const status = error?.response?.status;
  const serverMessage = error?.response?.data?.message;

  if (!error?.response) {
    return "Can't reach the server. Check your connection and try again.";
  }
  if (context === 'login' && status === 401) {
    // Generic on purpose: never reveal whether the email exists (CSQP-F-002).
    return 'Incorrect email or password.';
  }
  if (status === 429) {
    return 'Too many failed attempts. Your account is locked for 15 minutes.';
  }
  if (status === 409 && context === 'register') {
    return serverMessage || 'An account with this email already exists.';
  }
  return serverMessage || 'Something went wrong. Please try again.';
}

export function isUnverifiedError(error) {
  return error?.response?.data?.error === 'EMAIL_NOT_VERIFIED';
}
