// Client-side validation for the auth forms (CSQP-12).
// The server re-validates everything; these checks give instant feedback.

// College email rule from CSQP-F-001 / TC-Auth-01 ("college email (.edu)").
// Override with VITE_COLLEGE_EMAIL_SUFFIX, e.g. "pes.edu".
export const COLLEGE_EMAIL_SUFFIX = (
  import.meta.env.VITE_COLLEGE_EMAIL_SUFFIX || '.edu'
).toLowerCase();

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateName(name) {
  const value = (name || '').trim();
  if (!value) return 'Enter your full name.';
  if (value.length < 2) return 'Name must be at least 2 characters.';
  if (value.length > 60) return 'Name must be 60 characters or fewer.';
  return '';
}

export function validateEmailFormat(email) {
  const value = (email || '').trim();
  if (!value) return 'Enter your email address.';
  if (!EMAIL_PATTERN.test(value)) return 'Enter a valid email address.';
  return '';
}

export function validateCollegeEmail(email) {
  const formatError = validateEmailFormat(email);
  if (formatError) return formatError;
  if (!email.trim().toLowerCase().endsWith(COLLEGE_EMAIL_SUFFIX)) {
    return `Use your college email address (ending in ${COLLEGE_EMAIL_SUFFIX}).`;
  }
  return '';
}

export function validatePassword(password) {
  const value = password || '';
  if (!value) return 'Enter a password.';
  if (value.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) {
    return 'Password must contain at least one letter and one number.';
  }
  return '';
}

export function validateOtp(code) {
  const value = (code || '').trim();
  if (!value) return 'Enter the 6-digit code from your email.';
  if (!/^\d{6}$/.test(value)) return 'The code must be exactly 6 digits.';
  return '';
}

// Each form validator returns { field: message } for invalid fields only.
function collect(entries) {
  return Object.fromEntries(entries.filter(([, message]) => message));
}

export function validateLoginForm({ email, password }) {
  return collect([
    ['email', validateEmailFormat(email)],
    ['password', password ? '' : 'Enter your password.'],
  ]);
}

export function validateRegisterForm({ name, email, password, confirmPassword }) {
  return collect([
    ['name', validateName(name)],
    ['email', validateCollegeEmail(email)],
    ['password', validatePassword(password)],
    [
      'confirmPassword',
      !confirmPassword
        ? 'Re-enter your password.'
        : confirmPassword !== password
          ? 'Passwords do not match.'
          : '',
    ],
  ]);
}

export function validateVerifyForm({ email, code }) {
  return collect([
    ['email', validateEmailFormat(email)],
    ['code', validateOtp(code)],
  ]);
}
