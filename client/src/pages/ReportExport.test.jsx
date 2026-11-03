import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import analyticsService from '../services/analyticsService';
import { apiError, instructorUser, makeService, renderApp, studentUser } from '../test/renderWithAuth';

vi.mock('../services/analyticsService', () => ({
  default: {
    getMyPerformance: vi.fn(),
    getClassAnalytics: vi.fn(),
    exportMyPerformance: vi.fn(),
    exportClassAnalytics: vi.fn(),
  },
}));

const STUDENT = {
  attemptsCompleted: 1, averageScore: 80, bestScore: 80, latestScore: 80,
  scoreTrend: [{ attemptId: 'a1', quizTitle: 'Quiz 1', date: '2026-10-19T10:00:00Z', percentage: 80 }],
  history: [{ attemptId: 'a1', quizId: 'q1', quizTitle: 'Quiz 1', subject: 'DSA', submittedAt: '2026-10-19T10:00:00Z', score: 4, totalQuestions: 5, percentage: 80 }],
  topics: [], strengths: [], weaknesses: [],
};
const CLASS = {
  totalStudents: 3,
  quizzes: [{ quizId: 'q', title: 'Quiz', subject: 'DSA', questionCount: 5, totalStudents: 3, participants: 1,
    participationRate: 0.33, totalAttempts: 1, averageScore: 80, highestScore: 80, lowestScore: 80, mostMissedQuestions: [] }],
};

const loggedInAs = (user) =>
  makeService({ refresh: vi.fn().mockResolvedValue({ accessToken: 't', user }) });

let clicked;
beforeEach(() => {
  vi.clearAllMocks();
  clicked = [];
  URL.createObjectURL = vi.fn(() => 'blob:fake');
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
    clicked.push({ href: this.href, download: this.download });
  });
  analyticsService.getMyPerformance.mockResolvedValue(STUDENT);
  analyticsService.getClassAnalytics.mockResolvedValue(CLASS);
});
afterEach(() => vi.restoreAllMocks());

describe('Report export buttons (CSQP-30)', () => {
  it('student downloads their progress as PDF', async () => {
    const user = userEvent.setup();
    const blob = new Blob(['%PDF'], { type: 'application/pdf' });
    analyticsService.exportMyPerformance.mockResolvedValue({ blob, filename: 'csqp-my-progress-2026-10-30.pdf' });
    renderApp('/student/progress', loggedInAs(studentUser));

    await user.click(await screen.findByRole('button', { name: 'Download PDF' }));
    expect(analyticsService.exportMyPerformance).toHaveBeenCalledWith('pdf');
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(clicked).toEqual([{ href: 'blob:fake', download: 'csqp-my-progress-2026-10-30.pdf' }]);
  });

  it('instructor downloads class analytics as CSV', async () => {
    const user = userEvent.setup();
    analyticsService.exportClassAnalytics.mockResolvedValue({ blob: new Blob(['a,b']), filename: 'class.csv' });
    renderApp('/instructor/analytics', loggedInAs(instructorUser));

    await user.click(await screen.findByRole('button', { name: 'Download CSV' }));
    expect(analyticsService.exportClassAnalytics).toHaveBeenCalledWith('csv');
    expect(clicked[0].download).toBe('class.csv');
  });

  it('shows "Preparing…" and disables both buttons while the file is generated', async () => {
    const user = userEvent.setup();
    let finish;
    analyticsService.exportMyPerformance.mockReturnValue(new Promise((r) => { finish = r; }));
    renderApp('/student/progress', loggedInAs(studentUser));

    await user.click(await screen.findByRole('button', { name: 'Download CSV' }));
    expect(screen.getByRole('button', { name: 'Preparing…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeDisabled();
    finish({ blob: new Blob(['x']), filename: 'x.csv' });
    expect(await screen.findByRole('button', { name: 'Download CSV' })).toBeEnabled();
  });

  it('explains when export is unavailable', async () => {
    const user = userEvent.setup();
    analyticsService.exportMyPerformance.mockRejectedValue(apiError(503));
    renderApp('/student/progress', loggedInAs(studentUser));

    await user.click(await screen.findByRole('button', { name: 'Download PDF' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Export is temporarily unavailable');
    expect(clicked).toEqual([]);
  });

  it('hides export when there is nothing to export (instructor with no quizzes)', async () => {
    analyticsService.getClassAnalytics.mockResolvedValue({ totalStudents: 3, quizzes: [] });
    renderApp('/instructor/analytics', loggedInAs(instructorUser));
    await screen.findByText(/haven.t created any quizzes yet/);
    expect(screen.queryByRole('button', { name: 'Download PDF' })).not.toBeInTheDocument();
  });
});
