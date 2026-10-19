import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  adminUser,
  apiError,
  instructorUser,
  makeService,
  renderApp,
  studentUser,
} from '../test/renderWithAuth';

async function fillAndSubmit(user, email = 'asha@pes.edu', password = 'Password1') {
  await user.type(await screen.findByLabelText('College email'), email);
  await user.type(screen.getByLabelText('Password'), password);
  await user.click(screen.getByRole('button', { name: 'Log in' }));
}

describe('LoginPage', () => {
  it('shows field errors and focuses the first invalid field on empty submit', async () => {
    const user = userEvent.setup();
    const { service } = renderApp('/login');

    await user.click(await screen.findByRole('button', { name: 'Log in' }));

    expect(screen.getByText('Enter your email address.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(screen.getByLabelText('College email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('College email')).toHaveFocus();
    expect(service.login).not.toHaveBeenCalled();
  });

  it.each([
    ['student', studentUser, '/student', /Welcome, Asha/],
    ['instructor', instructorUser, '/instructor', /Welcome, Ravi/],
    ['admin', adminUser, '/admin', /Welcome, Meera/],
  ])('routes a %s to their dashboard after login', async (_role, account, path, heading) => {
    const user = userEvent.setup();
    const service = makeService({
      login: vi.fn().mockResolvedValue({ accessToken: 't', user: account }),
    });
    renderApp('/login', service);

    await fillAndSubmit(user, account.email);

    expect(await screen.findByRole('heading', { name: heading })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent(path);
    expect(service.login).toHaveBeenCalledWith({ email: account.email, password: 'Password1' });
  });

  it('shows a generic error on wrong credentials (CSQP-F-002)', async () => {
    const user = userEvent.setup();
    const service = makeService({ login: vi.fn().mockRejectedValue(apiError(401)) });
    renderApp('/login', service);

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
    expect(screen.getByLabelText('Password')).toHaveValue('');
  });

  it('explains the 15-minute lockout on 429 (CSQP-SR-005)', async () => {
    const user = userEvent.setup();
    const service = makeService({ login: vi.fn().mockRejectedValue(apiError(429)) });
    renderApp('/login', service);

    await fillAndSubmit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(/locked for 15 minutes/);
  });

  it('sends unverified users to the verify page', async () => {
    const user = userEvent.setup();
    const service = makeService({
      login: vi.fn().mockRejectedValue(apiError(403, { error: 'EMAIL_NOT_VERIFIED' })),
    });
    renderApp('/login', service);

    await fillAndSubmit(user);

    expect(await screen.findByRole('heading', { name: 'Verify your email' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/verify-email?email=asha%40pes.edu');
  });

  it('can be completed with the keyboard only (Tab + Enter)', async () => {
    const user = userEvent.setup();
    const service = makeService({
      login: vi.fn().mockResolvedValue({ accessToken: 't', user: studentUser }),
    });
    renderApp('/login', service);
    await screen.findByLabelText('College email');

    await user.tab();
    expect(screen.getByLabelText('College email')).toHaveFocus();
    await user.keyboard('asha@pes.edu');
    await user.tab();
    expect(screen.getByLabelText('Password')).toHaveFocus();
    await user.keyboard('Password1{Enter}');

    await waitFor(() => expect(service.login).toHaveBeenCalled());
    expect(await screen.findByRole('heading', { name: /Welcome, Asha/ })).toBeInTheDocument();
  });
});
