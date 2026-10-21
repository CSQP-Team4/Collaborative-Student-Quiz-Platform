import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getAuthErrorMessage } from '../auth/authService';
import AuthLayout from '../components/AuthLayout';
import FormField from '../components/FormField';
import useFocusFirstError from '../hooks/useFocusFirstError';
import { validateEmailFormat, validateVerifyForm } from '../utils/validation';

const FIELDS = ['email', 'code'];
const VERIFIED_NOTICE = 'Email verified. You can now log in.';

// CSQP-F-001: verify via the emailed OTP code, or via the emailed link
// (/verify-email?token=...&email=...), before the first login.
export default function VerifyEmailPage() {
  const { verifyEmail, resendVerification } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [values, setValues] = useState({ email: searchParams.get('email') || '', code: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState(location.state?.notice || '');
  const [submitting, setSubmitting] = useState(false);
  const [linkStatus, setLinkStatus] = useState(token ? 'checking' : 'none');

  const emailRef = useRef(null);
  const codeRef = useRef(null);
  const refs = useMemo(() => ({ email: emailRef, code: codeRef }), []);
  const focusFirstError = useFocusFirstError(FIELDS, refs);

  // Verification link from the email: verify automatically on page load.
  // The ref makes sure the single-use token is sent only once, even when
  // React StrictMode runs effects twice in development.
  const linkSent = useRef(false);
  useEffect(() => {
    if (!token || linkSent.current) return;
    linkSent.current = true;
    verifyEmail({ token, email: searchParams.get('email') || undefined })
      .then(() => navigate('/login', { replace: true, state: { notice: VERIFIED_NOTICE } }))
      .catch((error) => {
        setLinkStatus('failed');
        setFormError(
          `${getAuthErrorMessage(error, 'verify')} Enter the code from your email instead.`,
        );
      });
  }, [token, verifyEmail, navigate, searchParams]);

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    const found = validateVerifyForm(values);
    setErrors(found);
    if (Object.keys(found).length) {
      focusFirstError(found);
      return;
    }

    setSubmitting(true);
    try {
      await verifyEmail({ email: values.email.trim(), code: values.code.trim() });
      navigate('/login', { replace: true, state: { notice: VERIFIED_NOTICE } });
    } catch (error) {
      setFormError(getAuthErrorMessage(error, 'verify'));
      codeRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setFormError('');
    setNotice('');
    const emailError = validateEmailFormat(values.email);
    if (emailError) {
      setErrors({ email: emailError });
      emailRef.current?.focus();
      return;
    }
    try {
      const result = await resendVerification({ email: values.email.trim() });
      setNotice(result?.message || 'A new code has been sent.');
    } catch (error) {
      setFormError(getAuthErrorMessage(error, 'verify'));
    }
  }

  if (linkStatus === 'checking') {
    return (
      <AuthLayout title="Verifying your email">
        <p role="status">Checking your verification link…</p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Verify your email"
      subtitle="Enter the 6-digit code we emailed you. The code expires in 24 hours."
    >
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
          ref={codeRef}
          id="code"
          label="Verification code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={values.code}
          onChange={handleChange}
          error={errors.code}
          required
        />
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Verifying…' : 'Verify email'}
        </button>
      </form>

      <p className="auth-switch">
        Didn't get a code?{' '}
        <button type="button" className="btn-link" onClick={handleResend}>
          Resend code
        </button>
      </p>
      <p className="auth-switch">
        <Link to="/login">Back to log in</Link>
      </p>
    </AuthLayout>
  );
}
