import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import leaderboardService from '../services/leaderboardService';
import { apiError, instructorUser, makeService, renderApp, studentUser } from '../test/renderWithAuth';

vi.mock('../services/leaderboardService', () => ({
  default: { getLeaderboard: vi.fn(), getSettings: vi.fn(), updateSettings: vi.fn() },
}));

const OPTIONS = {
  quizzes: [
    { id: 'q1', title: 'DS Quiz 1', subject: 'DSA' },
    { id: 'q2', title: 'OS Quiz', subject: 'Operating Systems' },
  ],
  subjects: ['DSA', 'Operating Systems'],
};
const board = (over = {}) => ({
  options: OPTIONS, scope: 'quiz', selectedId: 'q1', label: 'DS Quiz 1', viewerOptedIn: true,
  entries: [
    { rank: 1, name: 'Priya Sharma', score: 100, quizzes: 1, attempts: 2, isYou: false },
    { rank: 1, name: 'Asha Rao', score: 100, quizzes: 1, attempts: 1, isYou: true },
    { rank: 3, name: 'Rahul Nair', score: 60, quizzes: 1, attempts: 1, isYou: false },
  ],
  ...over,
});
const loggedInAs = (user) => makeService({ refresh: vi.fn().mockResolvedValue({ accessToken: 't', user }) });

beforeEach(() => vi.clearAllMocks());

describe('Leaderboard page (CSQP-29)', () => {
  it('is linked from the student dashboard and ranks students with the viewer highlighted', async () => {
    const user = userEvent.setup();
    leaderboardService.getLeaderboard.mockResolvedValue(board());
    renderApp('/student', loggedInAs(studentUser));

    await user.click(await screen.findByRole('link', { name: 'Leaderboard' }));
    const rows = within(await screen.findByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(4);
    expect(rows[1]).toHaveTextContent('1Priya Sharma100%');
    expect(rows[2]).toHaveTextContent('Asha RaoYou');
    expect(rows[3]).toHaveTextContent('3Rahul Nair60%');
    expect(leaderboardService.getLeaderboard).toHaveBeenCalledWith({ scope: 'quiz', id: undefined });
  });

  it('switches between quizzes and to per-subject ranking', async () => {
    const user = userEvent.setup();
    leaderboardService.getLeaderboard
      .mockResolvedValueOnce(board())
      .mockResolvedValueOnce(board({ selectedId: 'q2', label: 'OS Quiz' }))
      .mockResolvedValueOnce(board({ scope: 'subject', selectedId: 'DSA', label: 'DSA' }));
    renderApp('/leaderboard', loggedInAs(studentUser));

    await user.selectOptions(await screen.findByLabelText('Quiz'), 'q2');
    expect(leaderboardService.getLeaderboard).toHaveBeenLastCalledWith({ scope: 'quiz', id: 'q2' });
    expect(await screen.findByRole('heading', { name: 'OS Quiz' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Per subject' }));
    expect(leaderboardService.getLeaderboard).toHaveBeenLastCalledWith({ scope: 'subject', id: undefined });
    expect(await screen.findByRole('columnheader', { name: 'Avg. best score' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Per subject' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('tells a student who opted out that they are hidden, with a link to settings', async () => {
    leaderboardService.getLeaderboard.mockResolvedValue(board({ viewerOptedIn: false }));
    renderApp('/leaderboard', loggedInAs(studentUser));
    expect(await screen.findByText(/hidden from the leaderboard/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Change this in profile settings' })).toHaveAttribute('href', '/student/settings');
  });

  it('instructors can view it too, without the opt-in notice', async () => {
    leaderboardService.getLeaderboard.mockResolvedValue(board({ viewerOptedIn: null }));
    renderApp('/leaderboard', loggedInAs(instructorUser));
    await screen.findByRole('table');
    expect(screen.queryByText(/hidden from the leaderboard/)).not.toBeInTheDocument();
  });

  it('shows an empty state and handles errors with retry', async () => {
    const user = userEvent.setup();
    leaderboardService.getLeaderboard
      .mockRejectedValueOnce(apiError(503))
      .mockResolvedValueOnce(board({ entries: [] }));
    renderApp('/leaderboard', loggedInAs(studentUser));

    expect(await screen.findByRole('alert')).toHaveTextContent('temporarily unavailable');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/No one on the leaderboard for this yet/)).toBeInTheDocument();
  });
});

describe('Profile settings opt-in toggle (CSQP-29)', () => {
  it('is off by default and saves the choice when switched on', async () => {
    const user = userEvent.setup();
    leaderboardService.getSettings.mockResolvedValue(false);
    leaderboardService.updateSettings.mockResolvedValue({ optIn: true, message: 'You now appear on the leaderboard.' });
    renderApp('/student/settings', loggedInAs(studentUser));

    const toggle = await screen.findByRole('switch', { name: /Show me on the leaderboard/ });
    expect(toggle).not.toBeChecked();
    await user.click(toggle);
    expect(leaderboardService.updateSettings).toHaveBeenCalledWith(true);
    expect(await screen.findByRole('status')).toHaveTextContent('You now appear on the leaderboard.');
    expect(toggle).toBeChecked();
  });

  it('keeps the old value if saving fails', async () => {
    const user = userEvent.setup();
    leaderboardService.getSettings.mockResolvedValue(true);
    leaderboardService.updateSettings.mockRejectedValue(apiError(500));
    renderApp('/student/settings', loggedInAs(studentUser));

    const toggle = await screen.findByRole('switch', { name: /Show me on the leaderboard/ });
    await user.click(toggle);
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
    expect(toggle).toBeChecked();
  });

  it('is only for students', async () => {
    renderApp('/student/settings', loggedInAs(instructorUser));
    expect(await screen.findByText(/instructor dashboard/i)).toBeInTheDocument();
    expect(leaderboardService.getSettings).not.toHaveBeenCalled();
  });
});
