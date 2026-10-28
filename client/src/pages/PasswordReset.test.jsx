import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../test/renderWithAuth';

describe('CSQP-31: Password Reset UI (TC-Auth-04)', () => {
  describe('ForgotPasswordPage', () => {
    it('validates college email and submits request', async () => {
      const user = userEvent.setup();
      const { service } = renderApp('/forgot-password');

      // Invalid email
      await user.type(await screen.findByLabelText('College email'), 'invalid@gmail.com');
      await user.click(screen.getByRole('button', { name: 'Send reset link' }));

      expect(screen.getByText(/Use your college email address/)).toBeInTheDocument();
      expect(service.forgotPassword).not.toHaveBeenCalled();

      // Valid college email
      await user.clear(screen.getByLabelText('College email'));
      await user.type(screen.getByLabelText('College email'), 'student@pes.edu');
      await user.click(screen.getByRole('button', { name: 'Send reset link' }));

      expect(service.forgotPassword).toHaveBeenCalledWith({ email: 'student@pes.edu' });
      expect(await screen.findByRole('status')).toHaveTextContent(
        /If an account exists with this college email/
      );
    });
  });

  describe('ResetPasswordPage', () => {
    it('shows error if reset token is missing', async () => {
      renderApp('/reset-password');

      expect(
        await screen.findByText(/Missing password reset token/)
      ).toBeInTheDocument();
    });

    it('validates password requirements and confirms match', async () => {
      const user = userEvent.setup();
      renderApp('/reset-password?token=test_token_123&email=student%40pes.edu');

      await user.type(await screen.findByLabelText('New password'), 'short');
      await user.type(screen.getByLabelText('Confirm new password'), 'short');
      await user.click(screen.getByRole('button', { name: 'Save new password' }));

      expect(screen.getByText('Password must be at least 8 characters.')).toBeInTheDocument();

      await user.clear(screen.getByLabelText('New password'));
      await user.type(screen.getByLabelText('New password'), 'NewPassword123');
      await user.clear(screen.getByLabelText('Confirm new password'));
      await user.type(screen.getByLabelText('Confirm new password'), 'DifferentPass123');
      await user.click(screen.getByRole('button', { name: 'Save new password' }));

      expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    });

    it('submits valid password reset and redirects to login', async () => {
      const user = userEvent.setup();
      const { service } = renderApp('/reset-password?token=valid_token_xyz&email=student%40pes.edu');

      await user.type(await screen.findByLabelText('New password'), 'BrandNewPass1');
      await user.type(screen.getByLabelText('Confirm new password'), 'BrandNewPass1');
      await user.click(screen.getByRole('button', { name: 'Save new password' }));

      expect(service.resetPassword).toHaveBeenCalledWith({
        token: 'valid_token_xyz',
        email: 'student@pes.edu',
        password: 'BrandNewPass1',
      });

      expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    });
  });
});
