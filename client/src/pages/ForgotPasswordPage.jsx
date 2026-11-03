import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getAuthErrorMessage } from '../auth/authService';
import AuthLayout from '../components/AuthLayout';
import FormField from '../components/FormField';
import { validateForgotPasswordForm } from '../utils/validation';

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const emailRef = useRef(null);

  function handleChange(event) {
    setEmail(event.target.value);
    if (error) setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    setSuccessMessage('');

    const found = validateForgotPasswordForm({ email });
    if (found.email) {
      setError(found.email);
      emailRef.current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const res = await forgotPassword({ email: email.trim() });
      setSuccessMessage(
        res?.message || 'If an account exists with this college email, a reset link has been sent.'
      );
    } catch (err) {
      setFormError(getAuthErrorMessage(err, 'forgot-password'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your college email address and we'll send you a password reset link."
    >
      {successMessage && (
        <p className="notice notice-success" role="status">
          {successMessage}
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
          value={email}
          onChange={handleChange}
          error={error}
          required
        />

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Sending link…' : 'Send reset link'}
        </button>
      </form>

      <p className="auth-switch">
        Remembered your password? <Link to="/login">Back to log in</Link>
      </p>
    </AuthLayout>
  );
}
