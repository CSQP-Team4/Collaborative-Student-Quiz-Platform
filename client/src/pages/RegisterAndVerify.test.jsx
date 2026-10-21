import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { apiError, makeService, renderApp } from '../test/renderWithAuth';

async function fillRegister(user, overrides = {}) {
  const v = {
    name: 'Asha Rao',
    email: 'asha@pes.edu',
    password: 'Password1',
    confirm: 'Password1',
    ...overrides,
  };
  await user.type(await screen.findByLabelText('Full name'), v.name);
  await user.type(screen.getByLabelText('College email'), v.email);
  await user.type(screen.getByLabelText('Password'), v.password);
  await user.type(screen.getByLabelText('Confirm password'), v.confirm);
  await user.click(screen.getByRole('button', { name: 'Create account' }));
}

describe('RegisterPage', () => {
  it('rejects a non-college email (TC-Auth-01)', async () => {
    const user = userEvent.setup();
    const { service } = renderApp('/register');

    await fillRegister(user, { email: 'asha@gmail.com' });

    expect(screen.getByText(/Use your college email address/)).toBeInTheDocument();
    expect(screen.getByLabelText('College email')).toHaveFocus();
    expect(service.register).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords', async () => {
    const user = userEvent.setup();
    renderApp('/register');

    await fillRegister(user, { confirm: 'Password2' });

    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
  });

  it('registers and moves to email verification', async () => {
    const user = userEvent.setup();
    const { service } = renderApp('/register');

    await fillRegister(user);

    expect(service.register).toHaveBeenCalledWith({
      name: 'Asha Rao',
      email: 'asha@pes.edu',
      password: 'Password1',
    });
    expect(await screen.findByRole('heading', { name: 'Verify your email' })).toBeInTheDocument();
    expect(screen.getByLabelText('College email')).toHaveValue('asha@pes.edu');
    expect(screen.getByRole('status')).toHaveTextContent('Code sent.');
  });

  it('shows the server message when the email is taken', async () => {
    const user = userEvent.setup();
    const service = makeService({
      register: vi
        .fn()
        .mockRejectedValue(apiError(409, { message: 'An account with this email already exists.' })),
    });
    renderApp('/register', service);

    await fillRegister(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('already exists');
  });
});

describe('VerifyEmailPage', () => {
  it('verifies with a 6-digit code and returns to login', async () => {
    const user = userEvent.setup();
    const { service } = renderApp('/verify-email?email=asha%40pes.edu');

    await user.type(await screen.findByLabelText('Verification code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify email' }));

    expect(service.verifyEmail).toHaveBeenCalledWith({ email: 'asha@pes.edu', code: '123456' });
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Email verified');
  });

  it('rejects a code that is not 6 digits', async () => {
    const user = userEvent.setup();
    const { service } = renderApp('/verify-email?email=asha%40pes.edu');

    await user.type(await screen.findByLabelText('Verification code'), '12ab');
    await user.click(screen.getByRole('button', { name: 'Verify email' }));

    expect(screen.getByText('The code must be exactly 6 digits.')).toBeInTheDocument();
    expect(service.verifyEmail).not.toHaveBeenCalled();
  });

  it('verifies automatically from the emailed link, once', async () => {
    const { service } = renderApp('/verify-email?token=abc123&email=asha%40pes.edu');

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(service.verifyEmail).toHaveBeenCalledTimes(1);
    expect(service.verifyEmail).toHaveBeenCalledWith({ token: 'abc123', email: 'asha@pes.edu' });
  });

  it('falls back to the code form if the link has expired', async () => {
    const service = makeService({
      verifyEmail: vi
        .fn()
        .mockRejectedValue(apiError(400, { message: 'That link has expired.' })),
    });
    renderApp('/verify-email?token=old&email=asha%40pes.edu', service);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That link has expired. Enter the code from your email instead.',
    );
    expect(screen.getByLabelText('Verification code')).toBeInTheDocument();
  });
});
