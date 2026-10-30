import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import analyticsService from '../services/analyticsService';
import { apiError, makeService, renderApp, studentUser } from '../test/renderWithAuth';

vi.mock('../services/analyticsService', () => ({
  default: { getMyPerformance: vi.fn() },
}));

const SUMMARY = {
  studentId: '1',
  attemptsCompleted: 3,
  averageScore: 75,
  bestScore: 100,
  latestScore: 100,
  scoreTrend: [
    { attemptId: 'a1', quizTitle: 'Quiz 1', date: '2026-10-19T10:00:00Z', percentage: 50 },
    { attemptId: 'a2', quizTitle: 'Quiz 2', date: '2026-10-21T10:00:00Z', percentage: 75 },
    { attemptId: 'a3', quizTitle: 'Quiz 3', date: '2026-10-23T10:00:00Z', percentage: 100 },
  ],
  history: [
    { attemptId: 'a3', quizId: 'q3', quizTitle: 'Quiz 3', subject: 'DSA', submittedAt: '2026-10-23T10:00:00Z', score: 4, totalQuestions: 4, percentage: 100 },
    { attemptId: 'a2', quizId: 'q2', quizTitle: 'Quiz 2', subject: 'DSA', submittedAt: '2026-10-21T10:00:00Z', score: 3, totalQuestions: 4, percentage: 75 },
    { attemptId: 'a1', quizId: 'q1', quizTitle: 'Quiz 1', subject: 'DSA', submittedAt: '2026-10-19T10:00:00Z', score: 2, totalQuestions: 4, percentage: 50 },
  ],
  topics: [
    { topic: 'Trees', answered: 4, correct: 4, mastery: 1, status: 'strength' },
    { topic: 'Sorting', answered: 4, correct: 3, mastery: 0.75, status: 'strength' },
    { topic: 'Graphs', answered: 4, correct: 1, mastery: 0.25, status: 'weakness' },
  ],
  strengths: ['Trees', 'Sorting'],
  weaknesses: ['Graphs'],
};

const loggedInStudent = () =>
  makeService({ refresh: vi.fn().mockResolvedValue({ accessToken: 't', user: studentUser }) });

beforeEach(() => {
  analyticsService.getMyPerformance.mockReset();
});

describe('Student progress page (CSQP-27)', () => {
  it('is linked from the student dashboard', async () => {
    const user = userEvent.setup();
    analyticsService.getMyPerformance.mockResolvedValue(SUMMARY);
    renderApp('/student', loggedInStudent());

    await user.click(await screen.findByRole('link', { name: 'My progress' }));
    expect(await screen.findByRole('heading', { name: 'My progress', level: 1 })).toBeInTheDocument();
  });

  it('shows summary numbers, trend, topics and history', async () => {
    analyticsService.getMyPerformance.mockResolvedValue(SUMMARY);
    renderApp('/student/progress', loggedInStudent());

    const stats = await screen.findByRole('list', { name: 'Summary' });
    expect(within(stats).getByText('3')).toBeInTheDocument();
    expect(within(stats).getByText('75%')).toBeInTheDocument();

    expect(screen.getByRole('img', { name: 'Score trend over 3 quizzes, from 50% to 100%.' })).toBeInTheDocument();

    expect(screen.getByText('Study next:')).toHaveTextContent('Study next: Graphs');
    expect(screen.getByRole('progressbar', { name: 'Graphs mastery' })).toHaveAttribute('aria-valuenow', '25');
    expect(screen.getByText('4 of 4 correct (100%)')).toBeInTheDocument();

    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(4); // header + 3 attempts
    expect(rows[1]).toHaveTextContent('Quiz 3');
    expect(rows[1]).toHaveTextContent('4/4 (100%)');
  });

  it('shows an empty state before the first quiz', async () => {
    analyticsService.getMyPerformance.mockResolvedValue({
      ...SUMMARY, attemptsCompleted: 0, history: [], scoreTrend: [], topics: [], strengths: [], weaknesses: [],
    });
    renderApp('/student/progress', loggedInStudent());

    expect(await screen.findByText(/haven.t completed any quizzes yet/)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('explains when analytics are down and can retry', async () => {
    const user = userEvent.setup();
    analyticsService.getMyPerformance
      .mockRejectedValueOnce(apiError(503))
      .mockResolvedValueOnce(SUMMARY);
    renderApp('/student/progress', loggedInStudent());

    expect(await screen.findByRole('alert')).toHaveTextContent('Analytics are temporarily unavailable');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(analyticsService.getMyPerformance).toHaveBeenCalledTimes(2);
  });

  it('is only for students', async () => {
    renderApp('/student/progress'); // not logged in
    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument();
    expect(analyticsService.getMyPerformance).not.toHaveBeenCalled();
  });
});
