import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import App from '../App';
import AuthProvider from '../auth/AuthProvider';
import LocationProbe from './LocationProbe';

// A fake auth service; each test overrides only what it needs.
export function makeService(overrides = {}) {
  const notLoggedIn = Object.assign(new Error('no session'), { response: { status: 401 } });
  return {
    register: vi.fn().mockResolvedValue({ message: 'Code sent.' }),
    verifyEmail: vi.fn().mockResolvedValue({ message: 'Verified.' }),
    resendVerification: vi.fn().mockResolvedValue({ message: 'New code sent.' }),
    forgotPassword: vi.fn().mockResolvedValue({ message: 'If an account exists with this college email, a reset link has been sent.' }),
    resetPassword: vi.fn().mockResolvedValue({ message: 'Password reset successful!' }),
    login: vi.fn(),
    refresh: vi.fn().mockRejectedValue(notLoggedIn),
    logout: vi.fn().mockResolvedValue(),
    ...overrides,
  };
}

export function apiError(status, data = {}) {
  return Object.assign(new Error(`HTTP ${status}`), { response: { status, data } });
}

// Renders the whole app at `route` with a fake auth service.
export function renderApp(route, service = makeService()) {
  const utils = render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider service={service}>
        <App />
        <Routes>
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
  return { ...utils, service };
}

export const studentUser = { id: '1', name: 'Asha Rao', email: 'asha@pes.edu', role: 'student' };
export const instructorUser = { id: '2', name: 'Ravi Kumar', email: 'ravi@pes.edu', role: 'instructor' };
export const adminUser = { id: '3', name: 'Meera Iyer', email: 'meera@pes.edu', role: 'admin' };
