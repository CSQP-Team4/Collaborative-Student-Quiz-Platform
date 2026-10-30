import { useCallback, useEffect, useMemo, useState } from 'react';
import { setAccessToken } from '../api/api';
import { AuthContext } from './AuthContext';
import { authService as defaultService } from './authService';

// Refresh tokens are single-use (rotated on every call, CSQP-SR-003). If two
// refreshes run at once, the second sends the already-used token, the server
// treats it as token theft and ends the session. React StrictMode runs the
// startup effect twice in development, which logged users out on every page
// reload. So concurrent calls share one in-flight request.
const inFlightRefresh = new WeakMap();

function refreshOnce(service) {
  if (!inFlightRefresh.has(service)) {
    const request = service.refresh().finally(() => inFlightRefresh.delete(service));
    inFlightRefresh.set(service, request);
  }
  return inFlightRefresh.get(service);
}

// Holds the logged-in user. On page load it tries the refresh-token cookie to
// restore the session, so the access token never has to be stored on disk.
export default function AuthProvider({ children, service = defaultService }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ready'

  useEffect(() => {
    let cancelled = false;
    refreshOnce(service)
      .then(({ accessToken, user: restored }) => {
        if (cancelled) return;
        setAccessToken(accessToken);
        setUser(restored);
      })
      .catch(() => {
        // No valid session: stay logged out.
      })
      .finally(() => {
        if (!cancelled) setStatus('ready');
      });
    return () => {
      cancelled = true;
    };
  }, [service]);

  const login = useCallback(
    async (credentials) => {
      const { accessToken, user: loggedIn } = await service.login(credentials);
      setAccessToken(accessToken);
      setUser(loggedIn);
      return loggedIn;
    },
    [service],
  );

  const logout = useCallback(async () => {
    try {
      await service.logout();
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, [service]);

  const value = useMemo(
    () => ({
      user,
      status,
      login,
      logout,
      register: service.register,
      verifyEmail: service.verifyEmail,
      resendVerification: service.resendVerification,
      forgotPassword: service.forgotPassword,
      resetPassword: service.resetPassword,
    }),
    [user, status, login, logout, service],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
