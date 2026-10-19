import { describe, expect, it } from 'vitest';
import {
  validateCollegeEmail,
  validateLoginForm,
  validateOtp,
  validatePassword,
  validateRegisterForm,
  validateVerifyForm,
} from './validation';

describe('validateCollegeEmail (CSQP-F-001)', () => {
  it('accepts a college .edu address', () => {
    expect(validateCollegeEmail('asha@pes.edu')).toBe('');
  });

  it('rejects a non-college address', () => {
    expect(validateCollegeEmail('asha@gmail.com')).toMatch(/college email/i);
  });

  it('rejects malformed and empty input', () => {
    expect(validateCollegeEmail('not-an-email')).toMatch(/valid email/i);
    expect(validateCollegeEmail('')).toMatch(/enter your email/i);
  });
});

describe('validatePassword', () => {
  it('requires 8+ characters with a letter and a number', () => {
    expect(validatePassword('abc1')).toMatch(/at least 8/);
    expect(validatePassword('abcdefgh')).toMatch(/letter and one number/);
    expect(validatePassword('12345678')).toMatch(/letter and one number/);
    expect(validatePassword('Password1')).toBe('');
  });
});

describe('validateOtp', () => {
  it('accepts exactly 6 digits', () => {
    expect(validateOtp('123456')).toBe('');
    expect(validateOtp('12345')).toMatch(/6 digits/);
    expect(validateOtp('12a456')).toMatch(/6 digits/);
    expect(validateOtp('')).toMatch(/6-digit code/);
  });
});

describe('form validators', () => {
  it('login: only checks presence and email format', () => {
    expect(validateLoginForm({ email: 'x@gmail.com', password: 'p' })).toEqual({});
    expect(Object.keys(validateLoginForm({ email: '', password: '' }))).toEqual([
      'email',
      'password',
    ]);
  });

  it('register: flags mismatched passwords', () => {
    const errors = validateRegisterForm({
      name: 'Asha Rao',
      email: 'asha@pes.edu',
      password: 'Password1',
      confirmPassword: 'Password2',
    });
    expect(errors).toEqual({ confirmPassword: 'Passwords do not match.' });
  });

  it('register: valid input has no errors', () => {
    expect(
      validateRegisterForm({
        name: 'Asha Rao',
        email: 'asha@pes.edu',
        password: 'Password1',
        confirmPassword: 'Password1',
      }),
    ).toEqual({});
  });

  it('verify: needs email and code', () => {
    expect(Object.keys(validateVerifyForm({ email: '', code: '' }))).toEqual(['email', 'code']);
  });
});
