import { useMemo, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getAuthErrorMessage, isUnverifiedError } from '../auth/authService';
import { ROLE_HOME, homeFor } from '../auth/roles';
import AuthLayout from '../components/AuthLayout';
import FormField from '../components/FormField';
import useFocusFirstError from '../hooks/useFocusFirstError';
import { validateLoginForm } from '../utils/validation';

const FIELDS = ['email', 'password'];

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const refs = useMemo(() => ({ email: emailRef, password: passwordRef }), []);
  const focusFirstError = useFocusFirstError(FIELDS, refs);

  const notice = location.state?.notice;

  if (user) return <Navigate to={homeFor(user)} replace />;

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    const found = validateLoginForm(values);
    setErrors(found);
    if (Object.keys(found).length) {
      focusFirstError(found);
      return;
    }

    setSubmitting(true);
    try {
      const loggedIn = await login({ email: values.email.trim(), password: values.password });
      // Return to the page they were sent from, if it belongs to their role.
      const from = location.state?.from;
      const target = from && from === ROLE_HOME[loggedIn.role] ? from : homeFor(loggedIn);
      navigate(target, { replace: true });
    } catch (error) {
      if (isUnverifiedError(error)) {
        navigate(`/verify-email?email=${encodeURIComponent(values.email.trim())}`, {
          state: { notice: 'Verify your email before logging in.' },
        });
        return;
      }
      setFormError(getAuthErrorMessage(error, 'login'));
      setValues((prev) => ({ ...prev, password: '' }));
      passwordRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Log in" subtitle="Use your college email to access CSQP.">
      {notice && (
        <p className="notice notice-success" role="status">
          {notice}
        </p>
      )}
      {formError && (
        <p className="notice notice-error" role="alert">
          {formError}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <FormField
          ref={emailRef}
          id="email"
          label="College email"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={handleChange}
          error={errors.email}
          required
        />
        <FormField
          ref={passwordRef}
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={values.password}
          onChange={handleChange}
          error={errors.password}
          required
        />
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>

      <p className="auth-switch">
        <Link to="/forgot-password">Forgot your password?</Link>
      </p>

      <p className="auth-switch">
        New to CSQP? <Link to="/register">Create an account</Link>
      </p>
    </AuthLayout>
  );
}
