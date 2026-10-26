import { useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { getAuthErrorMessage } from '../auth/authService';
import { homeFor } from '../auth/roles';
import AuthLayout from '../components/AuthLayout';
import FormField from '../components/FormField';
import useFocusFirstError from '../hooks/useFocusFirstError';
import { getDevVerificationCode } from '../utils/devVerificationCode';
import { COLLEGE_EMAIL_SUFFIX, validateRegisterForm } from '../utils/validation';

const FIELDS = ['name', 'email', 'password', 'confirmPassword'];

// Self-registration creates a Student account (CSQP-F-001). Instructor and
// Admin roles are assigned by an Admin (SRS 2.3), so there is no role picker.
export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();

  const [values, setValues] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);
  const refs = useMemo(
    () => ({ name: nameRef, email: emailRef, password: passwordRef, confirmPassword: confirmRef }),
    [],
  );
  const focusFirstError = useFocusFirstError(FIELDS, refs);

  if (user) return <Navigate to={homeFor(user)} replace />;

  function handleChange(event) {
    const { name, value } = event.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    const found = validateRegisterForm(values);
    setErrors(found);
    if (Object.keys(found).length) {
      focusFirstError(found);
      return;
    }

    setSubmitting(true);
    const email = values.email.trim();
    try {
      const result = await register({
        name: values.name.trim(),
        email,
        password: values.password,
      });
      navigate(`/verify-email?email=${encodeURIComponent(email)}`, {
        state: {
          notice: result?.message || 'We sent a verification code to your email.',
          // Development only: lets the verify page show the code (no email service yet).
          devCode: getDevVerificationCode(result),
        },
      });
    } catch (error) {
      setFormError(getAuthErrorMessage(error, 'register'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Register with your college email. You'll verify it before your first login."
    >
      {formError && (
        <p className="notice notice-error" role="alert">
          {formError}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <FormField
          ref={nameRef}
          id="name"
          label="Full name"
          autoComplete="name"
          value={values.name}
          onChange={handleChange}
          error={errors.name}
          required
        />
        <FormField
          ref={emailRef}
          id="email"
          label="College email"
          type="email"
          autoComplete="email"
          hint={`Must end in ${COLLEGE_EMAIL_SUFFIX}`}
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
          autoComplete="new-password"
          hint="At least 8 characters, with a letter and a number"
          value={values.password}
          onChange={handleChange}
          error={errors.password}
          required
        />
        <FormField
          ref={confirmRef}
          id="confirmPassword"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          value={values.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
          required
        />
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="auth-switch">
        Already registered? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}
