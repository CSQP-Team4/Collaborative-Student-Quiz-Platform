import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  instructorUser,
  makeService,
  renderApp,
  studentUser,
} from '../test/renderWithAuth';

const loggedInAs = (account) =>
  makeService({ refresh: vi.fn().mockResolvedValue({ accessToken: 't', user: account }) });

describe('role-based routing', () => {
  it('sends logged-out users from a dashboard to login', async () => {
    renderApp('/instructor');
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
  });

  it('keeps a student out of the instructor dashboard', async () => {
    renderApp('/instructor', loggedInAs(studentUser));
    expect(await screen.findByRole('heading', { name: /Welcome, Asha/ })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/student');
  });

  it('restores the session on reload and redirects "/" to the role home', async () => {
    renderApp('/', loggedInAs(instructorUser));
    expect(await screen.findByRole('heading', { name: /Welcome, Ravi/ })).toBeInTheDocument();
    expect(screen.getByText('Instructor')).toBeInTheDocument();
  });

  it('logs out back to the login page', async () => {
    const user = userEvent.setup();
    const service = loggedInAs(studentUser);
    renderApp('/student', service);

    await user.click(await screen.findByRole('button', { name: 'Log out' }));

    expect(service.logout).toHaveBeenCalled();
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('You have been logged out.');
  });
});
