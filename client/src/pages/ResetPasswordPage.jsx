import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getAuthErrorMessage } from '../auth/authService';
import AuthLayout from '../components/AuthLayout';
import FormField from '../components/FormField';
import useFocusFirstError from '../hooks/useFocusFirstError';
import { validateResetPasswordForm } from '../utils/validation';

const FIELDS = ['password', 'confirmPassword'];

export default function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [values, setValues] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const passwordRef = useRef(null);
  const confirmRef = useRef(null);
  const refs = useMemo(() => ({ password: passwordRef, confirmPassword: confirmRef }), []);
  const focusFirstError = useFocusFirstError(FIELDS, refs);

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');

    if (!token) {
      setFormError('Reset token is missing or invalid. Please request a new link.');
      return;
    }

    const found = validateResetPasswordForm(values);
    setErrors(found);
    if (Object.keys(found).length) {
      focusFirstError(found);
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword({
        token,
        email: email || undefined,
        password: values.password,
      });

      navigate('/login', {
        replace: true,
        state: { notice: 'Password reset successful! You can now log in with your new password.' },
      });
    } catch (err) {
      setFormError(getAuthErrorMessage(err, 'reset-password'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create new password"
      subtitle="Enter a strong new password for your CSQP account (minimum 8 characters, letter + number)."
    >
      {formError && (
        <p className="notice notice-error" role="alert">
          {formError}
        </p>
      )}

      {!token && (
        <p className="notice notice-error" role="alert">
          Missing password reset token. <Link to="/forgot-password">Request a new reset link</Link>.
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <FormField
          ref={passwordRef}
          id="password"
          label="New password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={handleChange}
          error={errors.password}
          required
        />

        <FormField
          ref={confirmRef}
          id="confirmPassword"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
          required
        />

        <button type="submit" className="btn btn-primary" disabled={submitting || !token}>
          {submitting ? 'Resetting password…' : 'Save new password'}
        </button>
      </form>

      <p className="auth-switch">
        Remembered your password? <Link to="/login">Back to log in</Link>
      </p>
    </AuthLayout>
  );
}
