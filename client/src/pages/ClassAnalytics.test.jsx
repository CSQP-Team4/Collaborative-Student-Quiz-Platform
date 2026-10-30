import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import analyticsService from '../services/analyticsService';
import { apiError, instructorUser, makeService, renderApp, studentUser } from '../test/renderWithAuth';

vi.mock('../services/analyticsService', () => ({
  default: { getClassAnalytics: vi.fn(), getMyPerformance: vi.fn() },
}));

const SUMMARY = {
  totalStudents: 5,
  quizzes: [
    {
      quizId: 'quiz-a', title: 'Trees and Graphs', subject: 'DSA', questionCount: 4, totalStudents: 5,
      participants: 3, participationRate: 0.6, totalAttempts: 4, averageScore: 75, highestScore: 100, lowestScore: 50,
      mostMissedQuestions: [
        { questionId: 'q4', text: 'What is BFS?', topic: 'Graphs', attempted: 3, missed: 2, correctRate: 0.33 },
        { questionId: 'q3', text: 'What is DFS?', topic: 'Graphs', attempted: 3, missed: 1, correctRate: 0.67 },
      ],
    },
    {
      quizId: 'quiz-b', title: 'Unattempted quiz', subject: 'DSA', questionCount: 3, totalStudents: 5,
      participants: 0, participationRate: 0, totalAttempts: 0, averageScore: null, highestScore: null, lowestScore: null,
      mostMissedQuestions: [],
    },
  ],
};

const loggedInAs = (user) =>
  makeService({ refresh: vi.fn().mockResolvedValue({ accessToken: 't', user }) });

beforeEach(() => {
  analyticsService.getClassAnalytics.mockReset();
});

describe('Class analytics page (CSQP-28)', () => {
  it('is linked from the instructor dashboard', async () => {
    const user = userEvent.setup();
    analyticsService.getClassAnalytics.mockResolvedValue(SUMMARY);
    renderApp('/instructor', loggedInAs(instructorUser));

    await user.click(await screen.findByRole('link', { name: 'Class analytics' }));
    expect(await screen.findByRole('heading', { name: 'Class analytics', level: 1 })).toBeInTheDocument();
  });

  it('shows average, participation and most-missed questions per quiz', async () => {
    analyticsService.getClassAnalytics.mockResolvedValue(SUMMARY);
    renderApp('/instructor/analytics', loggedInAs(instructorUser));

    const quiz = await screen.findByRole('region', { name: 'Trees and Graphs' });
    const stats = within(quiz).getByRole('list', { name: 'Trees and Graphs summary' });
    expect(within(stats).getByText('75%')).toBeInTheDocument();
    expect(within(stats).getByText('60%')).toBeInTheDocument();
    expect(within(stats).getByText('Participation (3 of 5 students)')).toBeInTheDocument();
    expect(within(stats).getByText('50–100%')).toBeInTheDocument();

    const rows = within(within(quiz).getByRole('table')).getAllByRole('row');
    expect(rows).toHaveLength(3);
    expect(rows[1]).toHaveTextContent('What is BFS?');
    expect(rows[1]).toHaveTextContent('2 of 3');
    expect(rows[1]).toHaveTextContent('33%');

    const empty = screen.getByRole('region', { name: 'Unattempted quiz' });
    expect(within(empty).getByText('No students have submitted this quiz yet.')).toBeInTheDocument();
  });

  it('refresh fetches the latest numbers', async () => {
    const user = userEvent.setup();
    analyticsService.getClassAnalytics
      .mockResolvedValueOnce(SUMMARY)
      .mockResolvedValueOnce({ ...SUMMARY, quizzes: [{ ...SUMMARY.quizzes[0], averageScore: 56.2 }] });
    renderApp('/instructor/analytics', loggedInAs(instructorUser));

    await screen.findByText('75%');
    await user.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(await screen.findByText('56.2%')).toBeInTheDocument();
  });

  it('shows an empty state when the instructor has no quizzes', async () => {
    analyticsService.getClassAnalytics.mockResolvedValue({ totalStudents: 5, quizzes: [] });
    renderApp('/instructor/analytics', loggedInAs(instructorUser));
    expect(await screen.findByText(/haven.t created any quizzes yet/)).toBeInTheDocument();
  });

  it('explains when analytics are down and can retry', async () => {
    const user = userEvent.setup();
    analyticsService.getClassAnalytics.mockRejectedValueOnce(apiError(503)).mockResolvedValueOnce(SUMMARY);
    renderApp('/instructor/analytics', loggedInAs(instructorUser));

    expect(await screen.findByRole('alert')).toHaveTextContent('temporarily unavailable');
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('region', { name: 'Trees and Graphs' })).toBeInTheDocument();
  });

  it('is not available to students', async () => {
    renderApp('/instructor/analytics', loggedInAs(studentUser));
    expect(await screen.findByText(/student dashboard/i)).toBeInTheDocument();
    expect(analyticsService.getClassAnalytics).not.toHaveBeenCalled();
  });
});
