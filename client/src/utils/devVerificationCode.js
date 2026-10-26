// Local-development helper for email verification (CSQP-F-001).
//
// No email service is connected yet, so in development the API returns the
// code as `_devVerificationCode` (only when NODE_ENV is not "production").
// This lets the verify page show and pre-fill it.
//
// Two safety gates: the server only sends the field outside production, and
// this helper only uses it when the client runs in Vite dev mode
// (import.meta.env.DEV is false in every production build).

const SIX_DIGITS = /^\d{6}$/;

export function isDevCodeEnabled() {
  return import.meta.env.DEV === true;
}

export function getDevVerificationCode(source) {
  if (!isDevCodeEnabled()) return '';
  const code = source?._devVerificationCode ?? source?.devCode;
  return typeof code === 'string' && SIX_DIGITS.test(code) ? code : '';
}
