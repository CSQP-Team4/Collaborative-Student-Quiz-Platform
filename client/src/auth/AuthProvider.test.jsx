import { StrictMode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AuthProvider from './AuthProvider';
import { useAuth } from './AuthContext';
import { makeService, studentUser } from '../test/renderWithAuth';

function WhoAmI() {
  const { user, status } = useAuth();
  return <p>{status === 'loading' ? 'loading' : user?.name || 'logged out'}</p>;
}

describe('AuthProvider session restore', () => {
  it('sends only ONE refresh request on page load, even in React StrictMode', async () => {
    // Refresh tokens are single-use: a second concurrent refresh would reuse
    // the old token and the server would end the session (reload = logout bug).
    const service = makeService({
      refresh: vi.fn().mockResolvedValue({ accessToken: 't', user: studentUser }),
    });
    render(
      <StrictMode>
        <AuthProvider service={service}>
          <WhoAmI />
        </AuthProvider>
      </StrictMode>,
    );
    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    expect(service.refresh).toHaveBeenCalledTimes(1);
  });

  it('stays logged out when there is no session', async () => {
    const service = makeService(); // refresh rejects with 401
    render(
      <StrictMode>
        <AuthProvider service={service}>
          <WhoAmI />
        </AuthProvider>
      </StrictMode>,
    );
    expect(await screen.findByText('logged out')).toBeInTheDocument();
    expect(service.refresh).toHaveBeenCalledTimes(1);
  });
});
