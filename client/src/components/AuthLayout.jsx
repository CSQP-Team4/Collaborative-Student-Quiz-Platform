import { isMockAuth } from '../auth/authService';
import { MOCK_VERIFICATION_CODE } from '../auth/mockAuthService';

// Shared frame for the login, register and verify pages.
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="brand">CSQP</p>
        <h1 id="auth-title">{title}</h1>
        {subtitle && <p className="auth-subtitle">{subtitle}</p>}
        {children}
      </section>
      {isMockAuth && (
        <aside className="mock-banner" aria-label="Demo mode">
          Demo mode (no backend). Log in as <code>student@pes.edu</code>,{' '}
          <code>instructor@pes.edu</code> or <code>admin@pes.edu</code> with{' '}
          <code>Password1</code>. Verification code: <code>{MOCK_VERIFICATION_CODE}</code>.
        </aside>
      )}
    </main>
  );
}
