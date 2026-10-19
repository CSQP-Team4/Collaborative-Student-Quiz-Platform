// In-browser stand-in for the auth API, enabled with VITE_USE_MOCK_AUTH=true.
// Lets the UI be demoed and tested before the real backend (CSQP-7/8/9) is merged.
// Not secure and not for production: data lives in this browser's localStorage.

const STORAGE_KEY = 'csqp-mock-auth';
export const MOCK_VERIFICATION_CODE = '123456';
const DEMO_PASSWORD = 'Password1';

const DEMO_USERS = [
  { id: 'u-student', name: 'Demo Student', email: 'student@pes.edu', role: 'student' },
  { id: 'u-instructor', name: 'Demo Instructor', email: 'instructor@pes.edu', role: 'instructor' },
  { id: 'u-admin', name: 'Demo Admin', email: 'admin@pes.edu', role: 'admin' },
].map((u) => ({ ...u, password: DEMO_PASSWORD, verified: true }));

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.users)) return saved;
  } catch {
    // ignore unreadable storage and start fresh
  }
  return { users: DEMO_USERS, sessionUserId: null };
}

function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // storage unavailable (private mode); mock still works for this page load
  }
}

// Shapes errors like axios so the UI handles mock and real API identically.
function apiError(status, error, message) {
  const err = new Error(message);
  err.response = { status, data: { success: false, statusCode: status, error, message } };
  return err;
}

function publicUser({ id, name, email, role }) {
  return { id, name, email, role };
}

const delay = () => new Promise((resolve) => setTimeout(resolve, 150));

const mockAuthService = {
  async register({ name, email, password }) {
    await delay();
    const state = load();
    const normalized = email.trim().toLowerCase();
    if (state.users.some((u) => u.email === normalized)) {
      throw apiError(409, 'EMAIL_TAKEN', 'An account with this email already exists.');
    }
    state.users.push({
      id: `u-${Date.now()}`,
      name: name.trim(),
      email: normalized,
      password,
      role: 'student',
      verified: false,
    });
    save(state);
    return { message: `Verification code sent (mock code: ${MOCK_VERIFICATION_CODE}).` };
  },

  async verifyEmail({ email, code, token }) {
    await delay();
    const state = load();
    const user = state.users.find((u) => u.email === (email || '').trim().toLowerCase());
    const valid = token ? token === MOCK_VERIFICATION_CODE : code === MOCK_VERIFICATION_CODE;
    if (!user || !valid) {
      throw apiError(400, 'INVALID_CODE', 'That code is invalid or has expired.');
    }
    user.verified = true;
    save(state);
    return { message: 'Email verified.' };
  },

  async resendVerification() {
    await delay();
    return { message: `A new code was sent (mock code: ${MOCK_VERIFICATION_CODE}).` };
  },

  async login({ email, password }) {
    await delay();
    const state = load();
    const user = state.users.find((u) => u.email === email.trim().toLowerCase());
    if (!user || user.password !== password) {
      throw apiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }
    if (!user.verified) {
      throw apiError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email before logging in.');
    }
    state.sessionUserId = user.id;
    save(state);
    return { accessToken: `mock-token-${user.id}`, user: publicUser(user) };
  },

  async refresh() {
    const state = load();
    const user = state.users.find((u) => u.id === state.sessionUserId);
    if (!user) throw apiError(401, 'NO_SESSION', 'Not logged in.');
    return { accessToken: `mock-token-${user.id}`, user: publicUser(user) };
  },

  async logout() {
    const state = load();
    state.sessionUserId = null;
    save(state);
  },
};

export default mockAuthService;
