import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeService, renderApp } from '../test/renderWithAuth';
import { getDevVerificationCode } from '../utils/devVerificationCode';

afterEach(() => {
  vi.unstubAllEnvs();
});

async function register(user) {
  await user.type(await screen.findByLabelText('Full name'), 'Asha Rao');
  await user.type(screen.getByLabelText('College email'), 'asha@pes.edu');
  await user.type(screen.getByLabelText('Password'), 'Password1');
  await user.type(screen.getByLabelText('Confirm password'), 'Password1');
  await user.click(screen.getByRole('button', { name: 'Create account' }));
}

describe('getDevVerificationCode', () => {
  it('accepts only a 6-digit code', () => {
    expect(getDevVerificationCode({ _devVerificationCode: '482910' })).toBe('482910');
    expect(getDevVerificationCode({ devCode: '482910' })).toBe('482910');
    expect(getDevVerificationCode({ _devVerificationCode: '12ab56' })).toBe('');
    expect(getDevVerificationCode({ _devVerificationCode: 482910 })).toBe('');
    expect(getDevVerificationCode(null)).toBe('');
  });

  it('is disabled outside development builds', () => {
    vi.stubEnv('DEV', false);
    expect(getDevVerificationCode({ _devVerificationCode: '482910' })).toBe('');
  });
});

describe('verification code in local development', () => {
  it('shows and pre-fills the code returned by register, then verifies', async () => {
    const user = userEvent.setup();
    const service = makeService({
      register: vi.fn().mockResolvedValue({ message: 'Registered.', _devVerificationCode: '482910' }),
    });
    renderApp('/register', service);

    await register(user);

    expect(await screen.findByTestId('dev-code-banner')).toHaveTextContent('482910');
    expect(screen.getByLabelText('Verification code')).toHaveValue('482910');

    await user.click(screen.getByRole('button', { name: 'Verify email' }));
    expect(service.verifyEmail).toHaveBeenCalledWith({ email: 'asha@pes.edu', code: '482910' });
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  it('updates the code after "Resend code"', async () => {
    const user = userEvent.setup();
    const service = makeService({
      resendVerification: vi
        .fn()
        .mockResolvedValue({ message: 'New code sent.', _devVerificationCode: '111222' }),
    });
    renderApp('/verify-email?email=asha%40pes.edu', service);

    expect(screen.queryByTestId('dev-code-banner')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Resend code' }));

    expect(await screen.findByTestId('dev-code-banner')).toHaveTextContent('111222');
    expect(screen.getByLabelText('Verification code')).toHaveValue('111222');
  });

  it('shows nothing when the server does not send a code (production API)', async () => {
    const user = userEvent.setup();
    renderApp('/register'); // default fake register returns only a message

    await register(user);

    expect(await screen.findByRole('heading', { name: 'Verify your email' })).toBeInTheDocument();
    expect(screen.queryByTestId('dev-code-banner')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Verification code')).toHaveValue('');
  });

  it('shows nothing in a production client build even if a code is sent', async () => {
    vi.stubEnv('DEV', false);
    const user = userEvent.setup();
    const service = makeService({
      register: vi.fn().mockResolvedValue({ message: 'Registered.', _devVerificationCode: '482910' }),
    });
    renderApp('/register', service);

    await register(user);

    expect(await screen.findByRole('heading', { name: 'Verify your email' })).toBeInTheDocument();
    expect(screen.queryByTestId('dev-code-banner')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Verification code')).toHaveValue('');
  });
});
